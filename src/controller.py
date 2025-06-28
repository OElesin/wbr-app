import io
import json
import logging # Already here, but good to double check
import os
import tempfile
import uuid
from pathlib import Path

import flask
import pandas
import requests
from cryptography.fernet import Fernet
from flask import Flask, request, send_file, render_template
from flask_cors import CORS
from werkzeug.utils import redirect

import src.controller_utility as controller_util
import src.test as test
import src.validator as validator
# Load database connections on startup
try:
    ALL_CONNECTIONS = controller_util.load_connections_config("connections.yaml") # Assuming connections.yaml is in root
    logging.info("Successfully loaded database connections.")
except Exception as e:
    logging.error(f"Failed to load database connections on startup: {e}", exc_info=True)
    # Depending on policy, either exit or run with limited functionality
    # For now, we'll let it proceed, but endpoints requiring DBs will fail.
    ALL_CONNECTIONS = {}

# Attempt to import agentic_ai and initialize client
try:
    from src.agentic_ai import AgenticAIClient
    agentic_ai_client = AgenticAIClient() # Initialize with default or environment-based config
    logging.info("AgenticAIClient initialized successfully.")
except ImportError:
    logging.warning("AgenticAI module (src.agentic_ai) not found. AI features will be disabled.")
    agentic_ai_client = None
except Exception as e:
    logging.error(f"Failed to initialize AgenticAIClient: {e}", exc_info=True)
    agentic_ai_client = None


import src.wbr as wbr
from src.publish_utility import PublishWbr

app = Flask(__name__,
            static_url_path='',
            static_folder='web/static',
            template_folder='web/templates')

cors = CORS(app, resources={r"/*": {"origins": "*"}})

key = Fernet.generate_key()

which_env = os.environ.get("ENVIRONMENT") or 'qa'
publisher = PublishWbr(os.getenv("OBJECT_STORAGE_OPTION"), os.environ.get("OBJECT_STORAGE_BUCKET"))


@app.route('/get-wbr-metrics', methods=['POST'])
def get_wbr_metrics():
    """
    A flask endpoint, build WBR for given data csv and config yaml file.
    :return: A json response for the frontend to render the data
    """
    # Get the WBR configuration file from the request
    config_file = request.files.get('configfile')
    if not config_file:
        return app.response_class(
            response=json.dumps({"description": "configfile is required."}),
            status=400
        )

    try:
        wbr_yaml_config = controller_util.load_yaml_from_stream(config_file)
    except Exception as e:
        logging.error(f"Error loading WBR config YAML: {e}", exc_info=True)
        return app.response_class(
            response=json.dumps({"description": f"Error loading WBR config YAML: {e}"}),
            status=500
        )

    if not ALL_CONNECTIONS:
        logging.error("Database connections not loaded. Cannot process request.")
        return app.response_class(
            response=json.dumps({"description": "Database connections are not configured or failed to load."}),
            status=500
        )

    try:
        # Get team_id from form data, default to 'all' if not provided
        team_id = request.form.get('team_id', 'all')

        # Pass the WBR YAML config, all loaded DB connections, and team_id to process_input
        deck = process_input(
            wbr_yaml_config=wbr_yaml_config,
            all_db_connections=ALL_CONNECTIONS,
            team_id=team_id # Pass team_id here
        )
    except Exception as e:
        logging.error(f"Error processing WBR input: {e}", exc_info=True)
        return app.response_class(
            response=json.dumps({"description": str(e)}),
            status=500
        )

    # Return the WBR deck as a JSON response
    return app.response_class(
        response=json.dumps(deck, indent=4, cls=controller_util.Encoder),
        status=200,
        mimetype='application/json'
    )


def process_input(wbr_yaml_config: dict, all_db_connections: dict, team_id: str = 'all'):
    """
    Processes the WBR request using database connections and team context.

    Args:
        wbr_yaml_config (dict): The parsed WBR YAML configuration.
        all_db_connections (dict): Dictionary of all available database connections.
        team_id (str): Identifier for the selected team, defaults to 'all'.

    Returns:
        dict: The generated WBR deck, potentially including AI insights.

    Raises:
        Exception: If any step in processing fails.
    """
    try:
        # data_sources are defined in the wbr_yaml_config
        data_sources = wbr_yaml_config.get('data_sources')
        if not data_sources:
            raise ValueError("'data_sources' not found in WBR configuration YAML.")

        # Initialize WBRValidator with data sources config, main WBR config, all connections, and team_id
        # The WBRValidator and wbr.WBR classes would need to be adapted to use team_id for filtering if that's desired.
        # For now, team_id is primarily for AI context and potential future filtering.
        wbr_validator = validator.WBRValidator(
            data_sources_config=data_sources,
            wbr_yaml_config=wbr_yaml_config,
            all_connections=all_db_connections,
            team_id=team_id # Pass team_id to validator
        )
        # This might need adjustment if validate_yaml expects CSV-specific things
        # or if validation rules change based on team.
        wbr_validator.validate_yaml()
    except Exception as e:
        logging.error(f"WBR Validation or data loading failed: {e}", exc_info=True)
        raise Exception(f"Invalid configuration or data loading error: {e}")

    try:
        # Create a WBR object using the DataFrame from WBRValidator and the WBR config
        # wbr.WBR might also need to be team_id aware for its processing.
        wbr1 = wbr.WBR(cfg=wbr_yaml_config, daily_df=wbr_validator.daily_df, team_id=team_id)
    except Exception as error:
        logging.error(error, exc_info=True)
        raise Exception(f"Could not create WBR metrics due to: {error.__str__()}")

    try:
        # Generate the WBR deck using the WBR object
        deck = controller_util.get_wbr_deck(wbr1)
        # Ensure 'teams' definition from YAML is included in the deck for the frontend
        if 'teams' in wbr_yaml_config:
            deck['teams'] = wbr_yaml_config['teams']
        else:
            deck['teams'] = [] # Send empty list if no teams defined

    except Exception as err:
        logging.error(err, exc_info=True)
        raise Exception(f"Error while creating deck, caused by: {err.__str__()}")

    # Agentic AI Integration
    ai_insights_data = None
    agentic_ai_config_yaml = wbr_yaml_config.get('agentic_ai_config', {})

    if agentic_ai_client and agentic_ai_config_yaml.get('enabled', False):
        try:
            # Determine team name for AI prompt context
            team_name_for_prompt = "Overall"
            if team_id != 'all' and deck.get('teams'):
                current_team_details = next((t for t in deck['teams'] if t.get('id') == team_id), None)
                if current_team_details:
                    team_name_for_prompt = current_team_details.get('name', team_id)

            # Prepare prompt
            prompt_template = agentic_ai_config_yaml.get(
                'prompt_template',
                "Analyze WBR data for {team_name}. Identify emerging trends, suggest new metrics, and summarize performance."
            )
            ai_prompt = prompt_template.format(team_name=team_name_for_prompt)

            # Pass relevant data to the AI. For simulation, wbr_validator.daily_df (if available) or a part of the deck.
            # In a real scenario, serialize df to JSON/CSV or pass specific metrics from 'deck'.
            # data_for_ai = wbr_validator.daily_df.to_json(orient='records') if wbr_validator.daily_df is not None else deck
            # For simulation, we can pass a simplified version of the deck or just a placeholder
            data_for_ai_simulation = {"metrics_summary": deck.get("blocks", [])[:5], "title": deck.get("title")}


            ai_insights_data = agentic_ai_client.generate_insights(
                data_input=data_for_ai_simulation, # Or more specific data
                context_prompt=ai_prompt,
                team_name=team_name_for_prompt
            )

            if ai_insights_data:
                logging.info("Successfully generated AI insights.")
            else:
                logging.warning("Agentic AI did not return insights (returned None).")
        except Exception as e:
            logging.error(f"Failed to generate AI insights: {e}", exc_info=True)
            # Non-fatal: log and continue without AI insights

    # Add AI insights to the main deck object if available
    if deck: # deck should always be a dict here based on get_wbr_deck
        deck['agentic_ai_insights'] = ai_insights_data if ai_insights_data else None

    return deck



@app.route('/download_yaml', methods=['POST'])
def download_yaml_for_csv():
    """
    Downloads a YAML file based on the provided CSV file.

    Returns:
        The downloaded YAML file as an attachment.
    """
    csv_data_file = request.files['csvfile']
    csv_data = pandas.read_csv(csv_data_file, parse_dates=['Date'], thousands=',')

    temp_file = tempfile.NamedTemporaryFile(mode="a", dir='/tmp/')

    try:
        from wbryamlgenerator.yaml_generator import generate
        csv_data_string: str = csv_data.head(3).to_csv(index=False)
        generate(csv_data_string, temp_file)
        return send_file(temp_file.name, mimetype='application/x-yaml', as_attachment=True)
    except Exception as e:
        logging.error(e, exc_info=True)
        logging.info("Exception occurred! falling back to the default implementation")
        controller_util.generate_custom_yaml(temp_file, csv_data)
        return send_file(temp_file.name, mimetype='application/x-yaml', as_attachment=True)


@app.route('/publish-wbr-report', methods=['POST'])
def publish_report(url=None, deck=None):
    """
    Fetch JSON file from the HTTP request, save the file to S3 bucket and publish the WBR to a public URL.

    Returns:
        A Flask response object with the URL to access the uploaded data.
    """
    # Parse the JSON data from the request
    data = json.loads(deck or request.data)

    # Modify the base URL to use HTTPS instead of HTTP
    base_url = url or request.base_url.replace('/publish-wbr-report', '')
    if "localhost" not in base_url and "127.0.0.1" not in base_url:
        base_url = base_url.replace("http", "https")

    return publish_and_get(base_url, '/build-wbr/publish?file=', data)


@app.route("/publish-protected-report", methods=['POST'])
def publish_protected_wbr(url=None, deck=None):
    """
    Saves the generated WBR report with a password
    :return: Redirect URL for the published report
    """
    # Get the password from the request arguments
    password = request.args['password']

    # Load the JSON data from the request body
    data = json.loads(deck or request.data)

    # Add the password to the JSON data
    protected_data = {"data": data, "password": password}

    # Get the base URL and replace 'http' with 'https'
    base_url = url or request.base_url.replace('/publish-protected-report', '')
    if "localhost" not in base_url and "127.0.0.1" not in base_url:
        base_url = base_url.replace("http", "https")
    return publish_and_get(base_url, '/build-wbr/publish/protected?file=', protected_data)


def publish_and_get(base_url: str, trailing_url: str, data: list | dict):
    # Generate a unique filename for the JSON data
    filename = str(uuid.uuid4())[25:]
    # Upload the report to cloud storage
    try:
        publisher.upload(data, which_env + "/" + filename)
        # Create a response with the URL to access the uploaded data
        return app.response_class(
            response=json.dumps({'path': f"{base_url}{trailing_url}{filename}"}, indent=4,
                                cls=controller_util.Encoder),
            status=200
        )
    except Exception as e:
        logging.error("Error occurred while publishing the report", e, exc_info=True)
        return app.response_class(
            status=500
        )


@app.route('/build-wbr/publish', methods=['GET'])
def build_wbr():
    """
    Builds unprotected WBR onto the web browser using the already saved WBR report
    :return: Rendered template of already generated report
    """
    filename = request.args['file']
    logging.info(f"Received request to download {filename}")
    try:
        data = publisher.download(which_env + "/" + filename)
    except Exception as e:
        logging.error(e, exc_info=True)
        return app.response_class(
            response=json.dumps({"message": "Failed to download your report!"}),
            status=500
        )
    return flask.render_template('wbr_share.html', data=data)


@app.route('/login', methods=["GET", "POST"])
def login():
    """
    A callback function when building a protected report onto web browser if successfully verify user redirected to
    build-wbr/publish/protected endpoint where protected WBR report will be rendered
    """
    # Get the file name from the request arguments
    file_name = request.args['file']

    if 'password' in request.args:
        # If password is provided in the request arguments
        auth_password = request.args['password']
        try:
            # Retrieve the JSON file from S3 bucket
            protected_data = publisher.download(which_env + "/" + file_name)
        except Exception as e:
            # Log any exceptions that occur during file retrieval
            logging.error(e, exc_info=True)
            return e.__str__()

        if auth_password == protected_data['password']:
            # If the provided password matches the password in the JSON file
            file_name = request.args['file']
            f = Fernet(key)
            # Encrypt the password and generate a token
            token = f.encrypt(bytes(auth_password, 'utf-8'))[:15]
            return redirect("/build-wbr/publish/protected?file=" + file_name +
                            "&password=" + str(token))
        else:
            # If the provided password does not match the password in the JSON file
            return app.response_class(
                response=json.dumps({"message": "Unauthorised"}),
                status=403
            )
    else:
        # If password is not provided in the request arguments
        return render_template("login.html", fileName=file_name)


@app.route('/build-wbr/publish/protected', methods=['GET'])
def build_wbr_protected():
    """
    Builds the protected WBR report, if user is not authenticated to view report user is redirected to login page.
    :return: Rendered WBR html file
    """
    if 'file' in request.args:
        auth_file_name = request.args['file']
        if 'password' not in request.args:
            return redirect('/login?file=' + auth_file_name)
        else:
            protected_data = publisher.download(which_env + "/" + auth_file_name)
            return flask.render_template('wbr_share.html', data=protected_data["data"])


@app.route('/build-wbr/sample', methods=['GET'])
def build_sample_wbr():
    """
    Builds sample WBR files.
    :return: Rendered sample WBR report html file
    """
    filename = request.args['file']
    base_path = str(Path(os.path.dirname(__file__)).parent)
    file = base_path + '/sample/' + filename
    current_file = open(file)
    data = json.load(current_file)
    return flask.render_template('wbr_share.html', data=data)


@app.route("/get_file_name", methods=['GET'])
def get_file_name():
    """
    Retrieve the sample reference files.
    :return: reference files
    """
    data_folder = Path(os.path.dirname(__file__)) / 'web/static/demo_uploads'
    files = os.listdir(data_folder)
    files.sort()
    return app.response_class(
        response=json.dumps(files, indent=4, cls=controller_util.Encoder),
        status=200,
        mimetype='application/json'
    )


@app.route('/wbr-unit-test', methods=["GET"])
def run_unit_test():
    """
    Unit test endpoint
    :return: Test results
    """
    test_result = test.test_wbr()
    return app.response_class(
        response=json.dumps(test_result, indent=4, cls=controller_util.Encoder),
        status=200,
        mimetype='application/json'
    )


@app.route('/report', methods=["POST"])
def build_report():
    output_type = request.args.get("outputType")

    # Validate if config file or config file url is present in the request
    if 'configUrl' not in request.args and 'configFile' not in request.files:
        return app.response_class(
            response=json.dumps(
                {'error': 'Either configUrl or configFile required!'}, indent=4,
                cls=controller_util.Encoder
            ),
            status=400
        )

    # Load WBR YAML config
    try:
        if 'configUrl' in request.args:
            wbr_yaml_config = controller_util.load_yaml_from_url(request.args["configUrl"])
        elif 'configFile' in request.files:
            wbr_yaml_config = controller_util.load_yaml_from_stream(request.files['configFile'])
        else:
            # This case should be caught by the check above, but as a safeguard
            return app.response_class(response=json.dumps({'error': 'Config not provided.'}), status=400)
    except Exception as e:
        logging.error(f"Failed to load WBR YAML config: {e}", exc_info=True)
        return app.response_class(
            response=json.dumps({"error": f"Failed to load WBR YAML config: {e}"}),
            status=500
        )

    # Override WBR config setup based on the url query parameters
    # Ensure 'setup' key exists
    if "setup" not in wbr_yaml_config:
        wbr_yaml_config["setup"] = {}

    if 'week_ending' in request.args:
        wbr_yaml_config["setup"]["week_ending"] = request.args["week_ending"]
    if 'week_number' in request.args:
        wbr_yaml_config["setup"]["week_number"] = int(request.args["week_number"])
    if 'title' in request.args:
        wbr_yaml_config["setup"]["title"] = request.args["title"]
    if 'fiscal_year_end_month' in request.args:
        wbr_yaml_config["setup"]["fiscal_year_end_month"] = request.args["fiscal_year_end_month"]
    if 'block_starting_number' in request.args:
        wbr_yaml_config["setup"]["block_starting_number"] = int(request.args["block_starting_number"])
    if 'tooltip' in request.args:
        wbr_yaml_config["setup"]["tooltip"] = request.args["tooltip"].lower() == "true" # Ensure boolean

    if not ALL_CONNECTIONS:
        logging.error("Database connections not loaded. Cannot process /report request.")
        return app.response_class(
            response=json.dumps({"description": "Database connections are not configured or failed to load."}),
            status=500
        )

    try:
        # process_input now expects the full WBR YAML config and all DB connections
        # Events data handling is removed from process_input for now.
        # If events data is still needed and comes from a separate CSV,
        # it would need to be loaded here and passed to wbr.WBR if that class still supports it.

        # Get team_id from request args for /report endpoint if provided
        report_team_id = request.args.get('team_id', 'all')

        deck = process_input(
            wbr_yaml_config=wbr_yaml_config,
            all_db_connections=ALL_CONNECTIONS,
            team_id=report_team_id # Pass team_id to process_input
        )
    except Exception as e:
        logging.error(f"Error processing WBR input for /report: {e}", exc_info=True)
        return app.response_class(
            response=json.dumps({"error": str(e)}),
            status=500
        )

    if output_type == "JSON":
        # Return the WBR deck as a JSON response
        return app.response_class(
            response=json.dumps([deck], indent=4, cls=controller_util.Encoder),
            status=200,
            mimetype='application/json'
        )
    elif output_type == "HTML":
        # Return the WBR deck as a JSON response
        return flask.render_template(
            'wbr_share.html',
            data=json.loads(json.dumps([deck], indent=4, cls=controller_util.Encoder))
        )
    else:
        return publish_protected_wbr(request.base_url.replace('/report', ''),
                                     json.dumps([deck], indent=4, cls=controller_util.Encoder)) \
            if "password" in request.args \
            else publish_report(request.base_url.replace('/report', ''),
                                json.dumps([deck], indent=4, cls=controller_util.Encoder))


def start():
    return app


if __name__ == "__main__":
    app.run(debug=False, port=5001, host='0.0.0.0')
