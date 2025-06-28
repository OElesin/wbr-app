FROM python:3.12.2-bookworm

WORKDIR /python-docker

COPY requirements.txt requirements.txt
COPY resource/wbryamlgenerator-0.1.tar.gz resource/wbryamlgenerator-0.1.tar.gz
RUN python -m pip install --upgrade pip
RUN pip --no-cache-dir install -r requirements.txt
RUN pip install resource/wbryamlgenerator-0.1.tar.gz

COPY . .

# Create a non-root user and group
RUN addgroup --system appgroup && adduser --system --ingroup appgroup appuser

# Ensure the app directory is owned by the new user
# This path should match WORKDIR. If WORKDIR changes, update this.
RUN chown -R appuser:appgroup /python-docker
# Ensure SESSION_FILE_DIR is writable by appuser if using filesystem sessions
# The default in app_config.py is ./ .flask_session/
# WORKDIR is /python-docker, so this becomes /python-docker/.flask_session/
RUN mkdir -p /python-docker/.flask_session && chown -R appuser:appgroup /python-docker/.flask_session

# Switch to the non-root user
USER appuser

EXPOSE 5001

CMD ["waitress-serve", "--port=5001", "src.controller:app"]
