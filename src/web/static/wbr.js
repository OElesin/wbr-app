// Global DOM Elements
const input = document.getElementById('submitter'); // Generate Report button in sidebar
const dataInput = document.getElementById('data'); // CSV file input
const dataInputLabel = document.getElementById('dataFileLabel');
const configInput = document.getElementById('config'); // YAML file input
const configInputLabel = document.getElementById('configFileLabel');
const downloadButton = document.getElementById('submitter-download'); // Download YAML button in modal
const downloadDataInput = document.getElementById('data1_yaml_gen'); // CSV input for YAML generation
const jsonFileInput = document.getElementById('jsonFile'); // JSON file input in modal
const jsonSubmitButton = document.getElementById('json_submitter'); // Upload JSON button in modal
const initialWBRPage = document.getElementById('initial-wbr-page');
const leftNavCloseButton = document.getElementById("close-left-nav-btn");
const yamlGeneratorLoader = document.getElementById("yaml_loader"); // Loader for YAML generation in sidebar
const docsDiv = document.getElementById("docs");
const pageLoaderDiv = document.getElementById('page_loader_div'); // Full page loader
const teamSelectElement = document.getElementById('team-select');
const teamSelectorWrapper = document.getElementById('team-space-selector-wrapper');

// Global State
var currentWBRData = null; // Holds the latest full WBR data object from backend
var currentUploadedDataFile = null;
var currentUploadedConfigFile = null;
var passwordGlobal = ''; // For publish functionality - consider scoping better if possible

// ECharts & Formatting Maps (unchanged)
const markerMap = new Map([["primary", "circle"], ["secondary", "rect"], ["tertiary", "diamond"], ["quaternary", "triangle"]]);
const cyColorMap = new Map([["primary", "#3A2FDE"], ["secondary", "#5B75F6"], ["tertiary", "#799FF3"], ["quaternary", "#9BBDE3"], ["quinary", "#9BBDE3"]]);
const pyColorMap = new Map([["primary", "#DA5069"], ["secondary", "#ffd6dd"], ["tertiary", "#fad9df"], ["quaternary", "#fae1e5"], ["quinary", "#fff0f2"]]);
const labelMap = new Map([["MM", "M"], ["BB", "B"], ["KK", "K"], ["bps", "bps"], ["%", "%"]]);


// --- Initialization and Event Listeners ---

// Helper function to safely get DOM elements
function $(selector) {
    return document.querySelector(selector);
}
function $$(selector) {
    return document.querySelectorAll(selector);
}


// Populate docs link on initial load
if (docsDiv) { // docsDiv is already a direct reference
    const docsAnchorTag = document.createElement('a');
    docsAnchorTag.href = "https://app.workingbackwards.com/docs/index.html";
    docsAnchorTag.target = "_blank"; // Open in new tab
    docsAnchorTag.rel = "noopener noreferrer";
    const docsSpan = document.createElement('span');
    docsSpan.className = "text-primary"; // Use Bootstrap class
    docsSpan.style.fontSize = "larger";
    docsSpan.innerHTML = '<i class="fas fa-book-open mr-2"></i>Learn how to get the most of the WBR App >';
    docsAnchorTag.appendChild(docsSpan);
    docsDiv.appendChild(docsAnchorTag);
}

// Event listener for "Generate YAML" button (Download YAML)
if (downloadButton) {
    downloadButton.addEventListener('click', () => {
        if (downloadDataInput.files.length > 0) {
            if(yamlGeneratorLoader) yamlGeneratorLoader.style.display = "block"; // Show sidebar loader
            downloadGeneratedYaml(downloadDataInput.files[0]);
            clearInputFile(downloadDataInput);
        } else {
            Swal.fire("No CSV file selected", "Please select a CSV file to generate YAML from.", "warning");
        }
    });
}

// Event listener for "Upload JSON" button
if (jsonSubmitButton) {
    jsonSubmitButton.addEventListener('click', () => {
        if (jsonFileInput.files.length > 0) {
            const file = jsonFileInput.files[0];
            const reader = new FileReader();
            reader.onload = function(event) {
                try {
                    const jsonData = JSON.parse(event.target.result);
                    if (initialWBRPage) initialWBRPage.style.display = "none";
                    if (teamSelectorWrapper) teamSelectorWrapper.style.display = 'none'; // Hide team selector for JSON uploads

                    // Assuming JSON structure matches what `drawCharts` expects
                    // If JSON contains multiple reports, handle accordingly. For now, assume one.
                    currentWBRData = Array.isArray(jsonData) ? jsonData[0] : jsonData;

                    // Clear previous charts before drawing new ones
                    const chartsContainer = document.getElementById('charts');
                    if (chartsContainer) chartsContainer.innerHTML = '';

                    createDynamicActionButtons(); // Publish, Download JSON buttons
                    drawWBR(currentWBRData);
                } catch (e) {
                    console.error("Error parsing JSON file:", e);
                    Swal.fire("Invalid JSON", "The uploaded file is not valid JSON.", "error");
                }
            };
            reader.readAsText(file);
            clearInputFile(jsonFileInput);
        } else {
            Swal.fire("No JSON file selected", "Please select a JSON file.", "warning");
        }
    });
}

// Event listener for "Generate Report" button (main CSV/YAML upload)
if (input) {
    input.addEventListener('click', ()_ => {
        currentUploadedDataFile = dataInput.files[0];
        currentUploadedConfigFile = configInput.files[0];

        if (!currentUploadedDataFile || !currentUploadedConfigFile) {
            Swal.fire("Missing Files", "Please select both a data CSV file and a configuration YAML file.", "warning");
            return;
        }
        // Team ID will be picked up from the teamSelectElement.value inside uploadAndProcessFiles
        uploadAndProcessFiles(currentUploadedDataFile, currentUploadedConfigFile);

        // Don't clear inputs here, clear them upon successful upload in uploadAndProcessFiles
        // UX: Keep files selected if there was an error.
        if (leftNavCloseButton) leftNavCloseButton.click(); // Close sidebar
    });
}

// Event listener for Team Selector change
if (teamSelectElement) {
    teamSelectElement.addEventListener('change', function() {
        const selectedTeamId = this.value;
        console.log("Team selected:", selectedTeamId);
        if (currentUploadedDataFile && currentUploadedConfigFile) {
            // Re-upload with the new team context
            uploadAndProcessFiles(currentUploadedDataFile, currentUploadedConfigFile, selectedTeamId);
        } else if (currentWBRData) {
            // If data is already loaded (e.g. from JSON) and we want to simulate team filtering client-side (not ideal for full filtering)
            // This branch might not be fully utilized if team filtering is purely backend.
            // For now, the primary mechanism is re-fetching from backend.
            console.log("WBR data exists, but team selection change typically requires re-fetch for proper filtering.");
            // To fully support team changes without re-upload, backend needs to accept team_id with existing data context, or client needs full dataset.
            // Let's assume for now that changing team with already uploaded CSV/YAML means re-processing those files with new team_id.
        }
    });
}

// Publish Modal Logic (using updated IDs from HTML)
const publishSubmitBtn = document.getElementById('submit_publish');
const publishPasswordCheckbox = document.getElementById("data0_publish");
const publishPasswordField = document.getElementById("password_publish");
const publishPasswordFieldsDiv = document.getElementById("password_fields_publish");
const publishShowPasswordCheckbox = document.getElementById('showPassword_publish');

if (publishPasswordCheckbox) {
    publishPasswordCheckbox.addEventListener('change', () => {
        if (publishPasswordCheckbox.checked) {
            publishPasswordFieldsDiv.style.display = "block";
            publishSubmitBtn.disabled = publishPasswordField.value === "";
            publishPasswordField.addEventListener('input', ()_ => { // Use an event listener for input
                publishSubmitBtn.disabled = publishPasswordField.value === "";
                if(!publishSubmitBtn.disabled) passwordGlobal = publishPasswordField.value;
            });
        } else {
            publishPasswordFieldsDiv.style.display = "none";
            publishPasswordField.value = "";
            publishSubmitBtn.disabled = false;
            passwordGlobal = "";
        }
    });
    // Initial state of button if checkbox is not checked
    if (!publishPasswordCheckbox.checked) {
       if(publishSubmitBtn) publishSubmitBtn.disabled = false;
    }
}

if (publishShowPasswordCheckbox) {
    publishShowPasswordCheckbox.onclick = function () {
        publishPasswordField.type = this.checked ? "text" : "password";
    };
}

if (publishSubmitBtn) {
    publishSubmitBtn.addEventListener('click', async () => {
        if (!currentWBRData) {
            Swal.fire("No Report Data", "Please generate a report first before publishing.", "warning");
            return;
        }
        // PasswordGlobal should be set by the input listener or checkbox change
        if (publishPasswordCheckbox.checked && !publishPasswordField.value) {
             Swal.fire("Password Required", "Please enter a password or uncheck 'Require Password'.", "warning");
            return;
        }
        passwordGlobal = publishPasswordCheckbox.checked ? publishPasswordField.value : "";

        const requestOptions = {
            method: 'POST',
            body: JSON.stringify([currentWBRData]), // Backend expects an array
            redirect: 'follow',
            headers: { 'Content-Type': 'application/json' }
        };
        const url = passwordGlobal === "" ? "/publish-wbr-report" : `/publish-protected-report?password=${encodeURIComponent(passwordGlobal)}`;
        try {
            const response = await fetch(url, requestOptions);
            if (response.ok) {
                const jsonResponse = await response.json();
                Swal.fire(swalConfigForCopyPopup(jsonResponse.path));
            } else {
                 const error = await response.json();
                Swal.fire(swalConfigForFailurePopup(`Failed to publish: ${error.message || 'Unknown error'}`));
            }
        } catch (error) {
            console.error('Error publishing report:', error);
            Swal.fire(swalConfigForFailurePopup("Error publishing report. Check console."));
        }
    });
}


// --- Core Functions ---

const uploadAndProcessFiles = async (dataFile, configFile, teamId = 'all') => {
    if (!dataFile || !configFile) {
        Swal.fire("Missing Files", "Data or Config file is missing.", "warning");
        return;
    }

    if (pageLoaderDiv) pageLoaderDiv.style.display = 'flex';

    const formdata = new FormData();
    formdata.append("configfile", configFile, configFile.name);
    formdata.append("csvfile", dataFile, dataFile.name);
    formdata.append("team_id", teamId); // Add team_id to the form data

    const requestOptions = {
        method: 'POST',
        body: formdata,
        redirect: 'follow'
    };

    try {
        const response = await fetch("/get-wbr-metrics", requestOptions);
        if (pageLoaderDiv) pageLoaderDiv.style.display = 'none';

        if (response.ok) {
            const wbrJSON = await response.json();
            if (initialWBRPage) initialWBRPage.style.display = "none";

            currentWBRData = wbrJSON; // Store the fetched data globally

            // Populate Team Selector if teams are defined in the config
            if (wbrJSON.teams && wbrJSON.teams.length > 0) {
                populateTeamSelector(wbrJSON.teams, teamId);
                if (teamSelectorWrapper) teamSelectorWrapper.style.display = 'block';
            } else {
                if (teamSelectorWrapper) teamSelectorWrapper.style.display = 'none';
            }

            // Clear previous charts
            const chartsContainer = document.getElementById('charts');
            if (chartsContainer) chartsContainer.innerHTML = '';

            createDynamicActionButtons();
            drawWBR(wbrJSON); // Single function to draw the entire WBR

            // Clear file inputs on successful upload
            clearInputFile(dataInput);
            clearInputFile(configInput);
            // Reset stored file objects, but keep names in labels
            currentUploadedDataFile = dataFile; // Keep for re-processing if team changes
            currentUploadedConfigFile = configFile; // Keep for re-processing
            // Update labels to show what was just processed.
            if (dataInputLabel) dataInputLabel.innerHTML = `<strong>${dataFile.name}</strong>`;
            if (configInputLabel) configInputLabel.innerHTML = `<strong>${configFile.name}</strong>`;


        } else {
            const error = await response.json();
            console.error("Error from backend:", error);
            displayErrorMessage(error.description || "Failed to build WBR deck.");
            // Don't clear inputs on error, so user can retry or adjust.
        }
    } catch (error) {
        console.error('Fetch error:', error);
        if (pageLoaderDiv) pageLoaderDiv.style.display = 'none';
        displayErrorMessage("Network error or server unavailable. Failed to build WBR deck.");
    }
};

function drawWBR(wbrData) {
    // Handle AI insights first
    const aiSection = $('#agentic-ai-insights'); // Use helper
    const aiMetricsContainer = $('#ai-metrics-container');
    const aiSummaryList = $('#ai-summary-list');

    if (wbrData.agentic_ai_insights && aiSection && aiMetricsContainer && aiSummaryList) {
        displayAgenticAIInsights(wbrData.agentic_ai_insights, aiMetricsContainer, aiSummaryList);
        aiSection.style.display = 'block';
    } else if (aiSection) {
        aiSection.style.display = 'none';
    }

    // Main WBR content (charts, tables, sections)
    const chartsContainer = $('#charts'); // Use helper
    if (!chartsContainer) {
        console.error("Charts container not found!");
        return;
    }
    chartsContainer.innerHTML = ''; // Clear previous content

    // The deckDiv will act as the main container for rows of cards
    const deckDiv = document.createElement('div');
    deckDiv.className = 'container-fluid'; // Bootstrap container for responsive padding & margins
    chartsContainer.appendChild(deckDiv);

    const titleDiv = createWBRTitle(wbrData);
    // Prepend titleDiv to deckDiv instead of chartsContainer directly for better structure
    deckDiv.appendChild(titleDiv);


    let counter = parseInt(wbrData.blockStartingNumber) || 1; // Ensure it's a number
    let tableIdCounter = 0;

    // Use Bootstrap's row for layout of metric blocks
    let currentRow = null;

    wbrData.blocks.forEach((blockData, index) => {
        if (blockData.plotStyle === 'section' || blockData.plotStyle === 'embedded_content') {
            // Sections and embedded content take full width, so close current row
            if (currentRow) {
                deckDiv.appendChild(currentRow);
                currentRow = null;
            }
            createFullWidthBlock(blockData, deckDiv); // New function for these types
        } else {
            // Chart, 6-week table, 12-month table are half-width items
            if (!currentRow || currentRow.children.length >= 2) { // Max 2 cards per row
                if (currentRow) deckDiv.appendChild(currentRow);
                currentRow = document.createElement('div');
                currentRow.className = 'row';
            }

            const cardWrapper = document.createElement('div');
            // Aim for 2 cards per row on medium screens and up, 1 on small
            cardWrapper.className = 'col-lg-6 col-md-6 col-sm-12 mb-4';

            switch (blockData.plotStyle) {
                case '6_12_chart':
                    createChartCard(blockData, cardWrapper, counter);
                    counter++;
                    break;
                case '6_week_table':
                    tableIdCounter++;
                    createSixWeeksTableCard(blockData, cardWrapper, `table-${tableIdCounter}`, counter);
                    counter++;
                    break;
                case '12_MonthsTable':
                    tableIdCounter++;
                    createTwelveMonthsTableCard(blockData, cardWrapper, `table-${tableIdCounter}`, counter);
                    counter++;
                    break;
                default:
                    console.warn("Unknown plotStyle:", blockData.plotStyle);
            }
            if (cardWrapper.children.length > 0) { // Only append if something was created
                 currentRow.appendChild(cardWrapper);
            }
        }
    });

    // Append the last row if it has any children
    if (currentRow && currentRow.children.length > 0) {
        deckDiv.appendChild(currentRow);
    }
}

function createFullWidthBlock(blockData, parentContainer) {
    const blockWrapper = document.createElement('div');
    blockWrapper.className = 'col-12 mb-4'; // Full width

    const card = document.createElement('div');
    card.className = 'card modern-card';

    const cardBody = document.createElement('div');
    cardBody.className = 'card-body';

    const elementId = `block-${blockData.plotStyle}-${Math.random().toString(36).substr(2, 9)}`;
    const contentDiv = document.createElement('div');
    contentDiv.id = elementId;

    if (blockData.plotStyle === 'section') {
        plotSectionTitle(contentDiv, blockData); // Renamed
        card.classList.add('section-card'); // Specific class for styling section cards
    } else if (blockData.plotStyle === 'embedded_content') {
        // Embedded content might need a header if title exists
        if (blockData.title) {
            const cardHeader = document.createElement('div');
            cardHeader.className = 'card-header';
            cardHeader.innerHTML = `<h3 class="h5 mb-0">${blockData.title}</h3>`;
            card.appendChild(cardHeader);
        }
        displayEmbeddedContent(contentDiv, blockData);
    }

    cardBody.appendChild(contentDiv);
    card.appendChild(cardBody);
    blockWrapper.appendChild(card);

    // Create a new row for this full-width block
    const row = document.createElement('div');
    row.className = 'row';
    row.appendChild(blockWrapper);
    parentContainer.appendChild(row);
}


function populateTeamSelector(teams, currentTeamId = 'all') {
    if (!teamSelectElement) return;
    teamSelectElement.innerHTML = '<option value="all">All Teams</option>'; // Default
    teams.forEach(team => {
        const option = document.createElement('option');
        option.value = team.id;
        option.textContent = team.name;
        if (team.id === currentTeamId) {
            option.selected = true;
        }
        teamSelectElement.appendChild(option);
    });
}

function createDynamicActionButtons() {
    let dynamicButtonDiv = document.getElementById('dynamic_buttons');
    if (dynamicButtonDiv) dynamicButtonDiv.remove(); // Remove if exists, to prevent duplicates

    dynamicButtonDiv = document.createElement('div');
    dynamicButtonDiv.className = 'no-print dynamic-buttons';
    dynamicButtonDiv.id = "dynamic_buttons";

    // Create Publish Button
    const publishButton = document.createElement('button');
    publishButton.className = 'btn btn-sm'; // Modernized classes
    publishButton.innerHTML = '<i class="fas fa-share-square"></i> Publish';
    publishButton.title = "Publish the report to a web link.";
    publishButton.dataset.toggle = "modal"; // Bootstrap modal toggle
    publishButton.dataset.target = "#publishModal";
    dynamicButtonDiv.appendChild(publishButton);

    // Create Download JSON Button
    const jsonButton = document.createElement('button');
    jsonButton.className = 'btn btn-sm'; // Modernized classes
    jsonButton.innerHTML = '<i class="fas fa-file-download"></i> Download JSON';
    jsonButton.title = "Download a JSON version of this WBR deck.";
    jsonButton.addEventListener('click', () => {
        if (currentWBRData) {
            const blob = new Blob([JSON.stringify([currentWBRData], null, 2)], { type: 'application/json' }); // Backend expects array
            const a = document.createElement("a");
            a.href = window.URL.createObjectURL(blob);
            a.download = `${currentWBRData.title || 'wbr_report'}_${currentWBRData.weekEnding || 'data'}.json`;
            a.click();
            window.URL.revokeObjectURL(a.href);
        } else {
            Swal.fire("No Data", "Please generate a report first.", "info");
        }
    });
    dynamicButtonDiv.appendChild(jsonButton);

    document.body.appendChild(dynamicButtonDiv); // Append to body to ensure it's on top
}


async function downloadGeneratedYaml(csvDataFile) {
    const formdata = new FormData();
    formdata.append("csvfile", csvDataFile, csvDataFile.name);

    const requestOptions = { method: 'POST', body: formdata };
    try {
        const response = await fetch("/download_yaml", requestOptions);
        if (yamlGeneratorLoader) yamlGeneratorLoader.style.display = "none";
        if (response.ok) {
            const blob = await response.blob();
            const a = document.createElement("a");
            a.href = window.URL.createObjectURL(blob);
            a.download = "wbr_config_generated.yaml";
            a.click();
            window.URL.revokeObjectURL(a.href);
        } else {
            console.error("Error generating YAML:", response.statusText);
            Swal.fire("YAML Generation Failed", "Could not generate YAML from the CSV.", "error");
        }
    } catch (error) {
        if (yamlGeneratorLoader) yamlGeneratorLoader.style.display = "none";
        console.error('Error downloading generated YAML:', error);
        Swal.fire("YAML Generation Error", "An error occurred. Check console.", "error");
    }
}

function displayErrorMessage(message) {
    const chartsContainer = document.getElementById('charts');
    if (chartsContainer) {
        chartsContainer.innerHTML = `<div class="error-message">${message}</div>`;
    }
    if (initialWBRPage) initialWBRPage.style.display = 'none'; // Hide initial page
    if (teamSelectorWrapper) teamSelectorWrapper.style.display = 'none'; // Hide team selector
}

// --- Chart and Table Plotting (Adapting to Card Layout) ---

function createWBRTitle(data) { // Renamed from createTitle
    const titleDiv = document.createElement('div');
    titleDiv.className = 'titleDiv text-center mb-4';
    const titleH2 = document.createElement('h2'); // Changed to h2 for better semantics
    titleH2.className = 'title display-5'; // Using Bootstrap display class
    let titleText = data.title || "Weekly Business Review";
    if (data.weekEnding) {
        titleText += ` (Week Ending ${data.weekEnding})`;
    }
    // If a team is selected (and not 'all'), append team name to title
    if (teamSelectElement && teamSelectElement.value !== 'all' && teamSelectElement.options.length > 0) {
        const selectedTeamName = teamSelectElement.options[teamSelectElement.selectedIndex].text;
        if (selectedTeamName !== "All Teams") { // Explicitly check against "All Teams" text
             titleText = `${selectedTeamName} - ${titleText}`;
        }
    }
    titleH2.innerHTML = titleText;
    titleDiv.appendChild(titleH2);
    return titleDiv;
}

function createChartCard(subData, parentWrapper, counter) {
    const card = document.createElement('div');
    card.className = 'card modern-card metric-block-card h-100'; // h-100 for consistent card height in a row

    const cardHeader = document.createElement('div');
    cardHeader.className = 'card-header';
    cardHeader.innerHTML = `<h3 class="h6 mb-0">${counter}. ${subData.title}</h3>`;
    card.appendChild(cardHeader);

    const cardBody = document.createElement('div');
    cardBody.className = 'card-body d-flex flex-column';

    const chartDivId = `chart-${counter}-${Math.random().toString(36).substr(2, 9)}`;
    const chartDiv = document.createElement('div');
    chartDiv.id = chartDivId;
    chartDiv.className = 'chartdiv-modern flex-grow-1'; // flex-grow-1 for chart to take space
    cardBody.appendChild(chartDiv);

    if (subData.table && subData.table.tableHeader && subData.table.tableBody) {
        const tableDivId = `table-${counter}-${Math.random().toString(36).substr(2, 9)}`;
        const tableDiv = document.createElement('div');
        tableDiv.id = tableDivId;
        tableDiv.className = 'tablediv-modern mt-3'; // margin top for spacing
        cardBody.appendChild(tableDiv);
        createDataTableForChart(tableDivId, subData); // Renamed
    }

    card.appendChild(cardBody);
    parentWrapper.appendChild(card);
    plotMetricChart(chartDivId, subData, counter); // Renamed
}

function createSixWeeksTableCard(subData, parentWrapper, tableId, counter) {
    const card = document.createElement('div');
    card.className = 'card modern-card metric-block-card h-100';

    const cardHeader = document.createElement('div');
    cardHeader.className = 'card-header';
    cardHeader.innerHTML = `<h3 class="h6 mb-0">${counter}. ${subData.title}</h3>`;
    card.appendChild(cardHeader);

    const cardBody = document.createElement('div');
    cardBody.className = 'card-body';

    const tableDivId = `blockTableDiv-${tableId}`;
    const tableContainer = document.createElement('div');
    tableContainer.id = tableDivId;
    tableContainer.className = 'table-responsive'; // For responsive tables

    cardBody.appendChild(tableContainer);
    card.appendChild(cardBody);
    parentWrapper.appendChild(card);

    plotSixWeeksTable(tableDivId, subData, tableId, counter); // Existing function, ensure it appends to tableContainer
}

function createTwelveMonthsTableCard(subData, parentWrapper, tableId, counter) {
    const card = document.createElement('div');
    card.className = 'card modern-card metric-block-card h-100';

    const cardHeader = document.createElement('div');
    cardHeader.className = 'card-header';
    cardHeader.innerHTML = `<h3 class="h6 mb-0">${counter}. ${subData.title}</h3>`;
    card.appendChild(cardHeader);

    const cardBody = document.createElement('div');
    cardBody.className = 'card-body';

    const tableDivId = `blockTableDiv-${tableId}`;
    const tableContainer = document.createElement('div');
    tableContainer.id = tableDivId;
    tableContainer.className = 'table-responsive';

    cardBody.appendChild(tableContainer);
    card.appendChild(cardBody);
    parentWrapper.appendChild(card);

    plotTwelveMonthsTable(tableDivId, subData, tableId, counter); // Existing function
}


// Renamed plotChart to plotMetricChart for clarity
function plotMetricChart(divId, subData, counter) {
    // ... (Keep existing ECharts plotting logic from plotChart)
    // Ensure title is handled by card header, or remove ECharts title if redundant
    var subseries = [];
    var primaryAxis = [];
    var secondayAxis = [];
    subData.yAxis.forEach(seriesData => {

        var lineName = seriesData.legendName;

        if (seriesData.lineStyle === undefined) {
            return;
        }

        if (seriesData.lineStyle !== "target") {

            if (subData.axes == 2) {
                primaryAxis.push(...extractSeriesData(seriesData, "current", "primary", 0, "metric"));
                primaryAxis.push(...extractSeriesData(seriesData, "previous", "primary", 0, "metric"));
                secondayAxis.push(...extractSeriesData(seriesData, "current", "secondary", 1, "metric"));
                secondayAxis.push(...extractSeriesData(seriesData, "previous", "secondary", 1, "metric"));
                subseries.push(createSeries(subData, seriesData, lineName, cyColorMap.get(seriesData.lineStyle), pyColorMap.get(seriesData.lineStyle), 1));
            }
            else if (subData.axes == 1) {
                primaryAxis.push(...extractSeriesData(seriesData, "current", "primary", 0, "metric"));
                primaryAxis.push(...extractSeriesData(seriesData, "previous", "primary", 0, "metric"));
                primaryAxis.push(...extractSeriesData(seriesData, "current", "secondary", 1, "metric"));
                primaryAxis.push(...extractSeriesData(seriesData, "previous", "secondary", 1, "metric"));
                subseries.push(createSeries(subData, seriesData, lineName, cyColorMap.get(seriesData.lineStyle), pyColorMap.get(seriesData.lineStyle), 0));
            }

        } else {

            if (subData.axes == 2) {
                primaryAxis.push(...extractSeriesData(seriesData, "current", "primary", 0, "Target"));
                secondayAxis.push(...extractSeriesData(seriesData, "current", "secondary", 1, "Target"));

                subseries.push(createTargetSeries(seriesData, lineName, 1));
            }
            else if (subData.axes == 1) {
                primaryAxis.push(...extractSeriesData(seriesData, "current", "primary", 0, "Target"));
                primaryAxis.push(...extractSeriesData(seriesData, "current", "secondary", 1, "Target"));

                subseries.push(createTargetSeries(seriesData, lineName, 0));
            }
        }
    });

    const primaryAllData = [].concat(...primaryAxis).filter(item => item !== undefined && !isNaN(item));
    const secondaryAllData = [].concat(...secondayAxis).filter(item => item !== undefined && !isNaN(item));

    const primaryOptions = setAxisOptions(primaryAllData);
    const secondaryOptions = setAxisOptions(secondaryAllData);

    const chartDom = document.getElementById(divId);
    if (!chartDom) {
        console.error(`Chart DOM element not found: ${divId}`);
        return;
    }
    const myChart = echarts.init(chartDom, null, { renderer: 'svg' });

    const resizeObserver = new ResizeObserver(() => {
        myChart.resize();
    });
    resizeObserver.observe(chartDom);

    const option = {
        title: {
            // text: counter + ". " + subData.title, // Title now in card header
            left: 'center',
            show: false // Hide ECharts title, use card header
        },
        tooltip: {
            show: (subData.tooltip === 'true' || subData.tooltip === true), // Ensure boolean check
            trigger: 'axis', // More common for line charts
            formatter: function (params) { // params is an array
                let tooltipHtml = `${params[0].name}<br/>`; // X-axis value (week/date)
                params.forEach(param => {
                    const seriesName = param.seriesName;
                    const value = param.value;
                    const color = param.color;
                    if (value !== undefined && value !== null) { // Check if value is valid
                         const formattedValue = dataLabelFormatter(subData.yScale, value, true); // Assuming yScale is on subData
                         tooltipHtml += `<span style="display:inline-block;margin-right:5px;border-radius:10px;width:10px;height:10px;background-color:${color};"></span>`;
                         tooltipHtml += `${seriesName}: <strong>${formattedValue}</strong><br/>`;
                    }
                });
                return tooltipHtml;
            }
        },
        xAxis: {
            type: 'category',
            data: subData && subData.xAxis,
            axisLabel: { interval: 0, rotate: 30 },
            position: 'bottom',
            axisLine: { onZero: false }
        },
        yAxis: createYAxisOptions(subData, primaryOptions, secondaryOptions), // Existing function
        legend: {
            left: 'center',
            top: 'bottom',
            itemWidth: 16,
            itemHeight: 10,
            itemGap: 10, // Increased gap
            padding: [20, 0, 0, 0] // Add padding to push legend down from chart
        },
        grid: { // Adjust grid to make space for legend and labels
            left: '3%',
            right: '4%',
            bottom: '15%', // Increased bottom for legend
            containLabel: true
        },
        series: subseries.flat(),
    };
    myChart.setOption(option);
}

// Renamed createTable to createDataTableForChart for clarity
function createDataTableForChart(dynamicTableDivId, subData) {
    // ... (Keep existing table creation logic from createTable)
    // Ensure table is appended to dynamicTableDivId and styled with Bootstrap classes
    // e.g., table.classList.add('table', 'table-sm', 'table-bordered');
    const { tableHeader: header, tableBody: body } = subData.table;

    const table = document.createElement("table");
    table.classList.add('table', 'table-sm', 'table-hover', 'mt-2'); // Bootstrap classes

    const thead = table.createTHead();
    const headerRow = thead.insertRow(-1);
    header.forEach(headerText => {
        const th = document.createElement("th");
        th.innerHTML = headerText;
        th.scope = "col";
        headerRow.appendChild(th);
    });

    const tbody = table.createTBody();
    body.forEach(rowData => {
        const row = tbody.insertRow(-1);
        rowData.forEach((cellData, index) => {
            const cell = row.insertCell(-1);
            // Use existing formatCellDataForTable function or adapt dataLabelFormatter
            cell.innerHTML = formatCellDataForTable(cellData, index, subData);
        });
    });

    const divShowData = document.getElementById(dynamicTableDivId);
    if (divShowData) {
        divShowData.innerHTML = ""; // Clear previous table
        divShowData.appendChild(table);
    } else {
        console.error(`Table container not found: ${dynamicTableDivId}`);
    }
}
// Helper to format data specifically for the small table under charts
function formatCellDataForTable(data, index, subDataConfig) {
    if (data === "N/A") return data;
    const { yScale: formatMask, boxTotalScale: boxTotalMask } = subDataConfig;
    let precision = 0;
    if (formatMask && formatMask.includes(".")) { // Check if formatMask is defined
        precision = formatMask.split(".")[1][0];
    }

    // Heuristic: First column is usually a label, others are values/percentages
    if (index === 0) return data; // Assume first column is label

    // For subsequent columns, apply formatting.
    // This logic is from original createTable, may need adjustment for context.
    // Typically, boxTotalScale applies to YoY % type columns.
    if ((index === 1 || index % 2 === 0) && boxTotalMask) { // Check if boxTotalMask is defined
        if (boxTotalMask.includes("bps")) {
            return (parseFloat(data) * 10000).toFixed(0) + "bps"; // bps usually no decimals
        } else if (boxTotalMask.includes("%")) {
            return (parseFloat(data) * 100).toFixed(precision) + "%";
        }
    }
    // Default formatting using yScale for other numeric columns
    if (formatMask && !isNaN(parseFloat(data))) {
        return dataLabelFormatter(formatMask, parseFloat(data), true);
    }
    return data; // Return as is if no specific formatting applies
}


// plotSixWeeksTable and plotTwelveMonthsTable remain largely the same internally
// but they should append their generated tables into the provided divId (which is now a tableContainer inside a card)
// And their tables should get Bootstrap classes e.g. table.classList.add('table', 'table-sm', 'table-bordered');

function plotSixWeeksTable(divId, subData, tableIdSuffix, counter) {
    const tableContainer = document.getElementById(divId);
    if (!tableContainer) {
        console.error("SixWeeksTable container not found:", divId);
        return;
    }
    tableContainer.innerHTML = ''; // Clear previous content

    const table = document.createElement('table');
    table.id = `sixWeeksTable-${tableIdSuffix}`;
    table.classList.add('table', 'table-sm', 'table-bordered', 'text-center'); // Added text-center
    // ... rest of the table building logic from original plotSixWeeksTable ...
    // Create title row - Title is now in card header, so this might be redundant or different
    // const titleRow = table.insertRow(-1);
    // const titleTh = document.createElement('th');
    // titleTh.colSpan = (subData.headers ? subData.headers.length : 0) + 1; // Adjust colspan
    // titleTh.className = "tableTitle"; // This class might need review for modern theme
    // titleTh.textContent = `${counter}. ${subData.title}`;
    // titleRow.appendChild(titleTh);

    const thead = table.createTHead();
    const headerRow = thead.insertRow(-1);
    const firstHeaderCell = document.createElement('th');
    firstHeaderCell.scope = "col";
    headerRow.appendChild(firstHeaderCell); // Empty top-left corner cell

    if(subData.headers) {
        subData.headers.forEach(headerText => {
            const th = document.createElement('th');
            th.scope = "col";
            th.textContent = headerText;
            headerRow.appendChild(th);
        });
    }

    const tbody = table.createTBody();
    if (subData.rows) {
        subData.rows.forEach(row => {
            const dataRow = tbody.insertRow(-1);
            // Row header
            const headerCell = document.createElement('th'); // Use <th> for row headers for semantics
            headerCell.scope = "row";
            headerCell.textContent = row.rowHeader;
            headerCell.style.cssText = row.rowStyle || ''; // Apply existing styles
            dataRow.appendChild(headerCell);

            // Row data cells
            const formatMask = row.yScale;
            const precision = formatMask && formatMask.includes(".") ? formatMask.split(".")[1][0] : 0;

            if (row.rowData && row.rowData.length === 0 && subData.headers) {
                subData.headers.forEach(() => {
                    const emptyCell = dataRow.insertCell(-1);
                    emptyCell.textContent = "-"; // Use a dash for empty cells
                });
            } else if (row.rowData) {
                row.rowData.forEach(cellData => {
                    const dataCell = dataRow.insertCell(-1);
                    // Use global formatCellData, ensure it's appropriate or make specific one
                    dataCell.textContent = formatCellData(cellData, formatMask, precision);
                });
            }
        });
    }
    tableContainer.appendChild(table);
}

function plotTwelveMonthsTable(divId, subData, tableIdSuffix, counter) {
    const tableContainer = document.getElementById(divId);
     if (!tableContainer) {
        console.error("TwelveMonthsTable container not found:", divId);
        return;
    }
    tableContainer.innerHTML = ''; // Clear previous content

    const table = document.createElement('table');
    table.id = `twelveMonthsTable-${tableIdSuffix}`;
    table.classList.add('table', 'table-sm', 'table-bordered', 'text-center');
    // ... (rest of the table building logic, similar to plotSixWeeksTable, ensuring Bootstrap classes) ...
    const thead = table.createTHead();
    const headerRow = thead.insertRow(-1);
    const firstHeaderCell = document.createElement('th');
    firstHeaderCell.scope = "col";
    headerRow.appendChild(firstHeaderCell); // Empty top-left

    if (subData.headers) {
        subData.headers.forEach(headerText => {
            const th = document.createElement('th');
            th.scope = "col";
            th.textContent = headerText;
            headerRow.appendChild(th);
        });
    }

    const tbody = table.createTBody();
    if (subData.rows) {
        subData.rows.forEach(row => {
            const dataRow = tbody.insertRow(-1);
            const headerCell = document.createElement('th');
            headerCell.scope = "row";
            headerCell.textContent = row.rowHeader;
            headerCell.style.cssText = row.rowStyle || '';
            dataRow.appendChild(headerCell);

            const formatMask = row.yScale;
            const precision = formatMask && formatMask.includes(".") ? formatMask.split(".")[1][0] : 0;

            if (row.rowData && row.rowData.length > 0) {
                 row.rowData.forEach(cellData => {
                    const td = dataRow.insertCell(-1);
                    td.textContent = formatCellData(cellData, formatMask, precision);
                });
            } else if (subData.headers) { // Fill with empty cells if no rowData
                 subData.headers.forEach(() => {
                    const td = dataRow.insertCell(-1);
                    td.textContent = "-";
                });
            }
        });
    }
    tableContainer.appendChild(table);
}


// Renamed plotSection to plotSectionTitle
function plotSectionTitle(contentDiv, subData) {
    // Sections are now full-width cards. This function places title within card body.
    contentDiv.innerHTML = ''; // Clear content div
    const h3 = document.createElement('h3');
    h3.className = 'h4 text-center text-secondary'; // Bootstrap classes for styling
    h3.textContent = subData.title;
    contentDiv.appendChild(h3);
}

function displayEmbeddedContent(contentDiv, subData) {
    contentDiv.innerHTML = ''; // Clear content div
    const iframe = document.createElement("iframe");
    iframe.id = subData.id || `embed-${Math.random().toString(36).substr(2, 9)}`;
    iframe.src = subData.source;
    iframe.title = subData.title || "Embedded Content";
    iframe.setAttribute("aria-label", iframe.title);
    iframe.setAttribute("frameborder", "0"); // Modern practice
    iframe.style.width = "100%";
    // Height needs to be responsive or set carefully. Use aspect ratio if possible.
    // For now, use specified height or a default.
    iframe.style.height = subData.height ? `${subData.height}px` : "450px";
    iframe.style.border = "none"; // Ensure no iframe border

    contentDiv.appendChild(iframe);
}


// --- Utility Functions (some might be unchanged or slightly adapted) ---
// clearInputFile, fetchSvgIcon (if used), swalConfig... etc.

function clearInputFile(fileInput) {
    if (fileInput) {
        try {
            fileInput.value = ''; // For most modern browsers
        } catch (err) {
            console.warn("Could not clear file input value directly:", err);
        }
        if (fileInput.value) { // Fallback for older IEs
            const form = document.createElement('form');
            const parentNode = fileInput.parentNode;
            const ref = fileInput.nextSibling;
            form.appendChild(fileInput);
            form.reset();
            parentNode.insertBefore(fileInput, ref);
        }
    }
}

// --- AI Insights Display Function ---
function displayAgenticAIInsights(aiInsightsData, metricsContainer, summaryList) {
    metricsContainer.innerHTML = ''; // Clear previous metrics
    summaryList.innerHTML = '';    // Clear previous summary

    // Populate AI Generated Metrics
    if (aiInsightsData.generated_metrics && aiInsightsData.generated_metrics.length > 0) {
        aiInsightsData.generated_metrics.forEach(metric => {
            const trendIcon = metric.trend === 'up' ? '<i class="fas fa-arrow-up text-success ml-2"></i>' :
                              metric.trend === 'down' ? '<i class="fas fa-arrow-down text-danger ml-2"></i>' :
                              metric.trend === 'stable' ? '<i class="fas fa-minus text-muted ml-2"></i>' : '';

            const metricCardHTML = `
                <div class="col-md-6 col-lg-4 mb-3">
                    <div class="card modern-card ai-metric-card h-100">
                        <div class="card-body">
                            <h6 class="card-title text-primary">${metric.name}</h6>
                            <p class="card-text display-5 metric-value">${metric.value} ${trendIcon}</p>
                            ${metric.details ? `<p class="card-text metric-details small text-muted">${metric.details}</p>` : ''}
                        </div>
                    </div>
                </div>
            `;
            metricsContainer.innerHTML += metricCardHTML;
        });
    } else {
        metricsContainer.innerHTML = '<p class="col-12 text-muted">No new metrics generated by AI at this time.</p>';
    }

    // Populate AI Insights Summary
    if (aiInsightsData.insights_summary && aiInsightsData.insights_summary.length > 0) {
        aiInsightsData.insights_summary.forEach(summaryPoint => {
            const listItem = document.createElement('li');
            listItem.className = 'list-group-item'; // Bootstrap styling
            listItem.innerHTML = `<i class="fas fa-lightbulb text-warning mr-2"></i>${summaryPoint}`;
            summaryList.appendChild(listItem);
        });
    } else {
        const listItem = document.createElement('li');
        listItem.className = 'list-group-item text-muted';
        listItem.textContent = 'No summary insights available from AI at this time.';
        summaryList.appendChild(listItem);
    }
}


// --- Utility Functions (some might be unchanged or slightly adapted) ---

function clearInputFile(fileInput) {
    if (fileInput) {
        try {
            fileInput.value = ''; // For most modern browsers
        } catch (err) {
            console.warn("Could not clear file input value directly:", err);
        }
        if (fileInput.value) { // Fallback for older IEs
            const form = document.createElement('form');
            const parentNode = fileInput.parentNode;
            const ref = fileInput.nextSibling;
            form.appendChild(fileInput);
            form.reset();
            parentNode.insertBefore(fileInput, ref);
        }
    }
}

// Swal configurations
function swalConfigForCopyPopup(message) {
    return {
        title: "Copy this URL to share your WBR report.",
        confirmButtonText: "COPY & CLOSE",
        html: `<p>Your report is available at:</p><input type="text" value="${message}" id="shareableLinkInput" class="form-control" readonly><p class="mt-2"><small>Click the button to copy the link.</small></p>`,
        showCancelButton: false,
        didOpen: () => {
            const input = Swal.getPopup().querySelector('#shareableLinkInput');
            input.select();
            input.setSelectionRange(0, 99999);
        },
        preConfirm: () => {
            const input = Swal.getPopup().querySelector('#shareableLinkInput');
            navigator.clipboard.writeText(input.value).then(() => {
                Swal.fire({text:'Link copied!', icon: 'success', timer: 1500, showConfirmButton: false });
            }).catch(err => {
                Swal.showValidationMessage(`Could not copy: ${err}`);
            });
            return false;
        },
        allowOutsideClick: true,
    };
}

function swalConfigForFailurePopup(message) {
    return {
        icon: 'error',
        title: 'Operation Failed',
        text: message,
        showConfirmButton: true,
        confirmButtonText: "OK",
        allowOutsideClick: true,
    };
}

// Data formatting and ECharts helpers
function getLabel(mask, addLabel) {
    return addLabel ? labelMap.get(mask) : "";
}

function dataLabelFormatter(formatMask, value, addLabel) {
    let precision = 0;
    let formatted = value;
    if (typeof value !== 'number') return String(value); // Guard against non-numeric values, return as string

    if (formatMask && formatMask.includes(".")) {
        precision = parseInt(formatMask.split(".")[1][0], 10); // Ensure precision is a number
    }

    if (formatMask) { // Ensure formatMask is defined
        if (formatMask.includes("MM")) {
            formatted = ((value / 1000000).toFixed(precision)) + getLabel("MM", addLabel);
        } else if (formatMask.includes("BB")) {
            formatted = ((value / 1000000000).toFixed(precision)) + getLabel("BB", addLabel);
        } else if (formatMask.includes("KK")) {
            formatted = ((value / 1000).toFixed(precision)) + getLabel("KK", addLabel);
        } else if (formatMask.includes("bps")) {
            formatted = ((value * 10000).toFixed(precision)) + getLabel("bps", addLabel);
        } else if (formatMask.includes("%")) {
            formatted = ((value * 100).toFixed(precision)) + getLabel("%", addLabel);
        } else {
            formatted = value.toFixed(precision);
        }
    } else { // Default if no formatMask
         formatted = Number.isInteger(value) ? String(value) : value.toFixed(2);
    }
    return formatted;
}

function createSeries(subData, seriesData, lineName, cyColor, pyColor, yAxisIndex = 0) {
    return [
        {
            name: `${lineName} - CY`, type: 'line', smooth: true,
            label: { show: true, formatter: params => dataLabelFormatter(subData.yScale, params.value) },
            color: cyColor, symbol: markerMap.get(seriesData.lineStyle), symbolSize: 8,
            data: seriesData?.metric?.current?.[0]?.primaryAxis,
            coordinateSystem: 'cartesian2d'
        },
        {
            name: `${lineName} - CY`, type: 'line', smooth: true,
            label: { show: true, formatter: params => dataLabelFormatter(subData.yScale, params.value) },
            data: seriesData?.metric?.current?.[1]?.secondaryAxis,
            color: cyColor, coordinateSystem: 'cartesian2d', yAxisIndex: yAxisIndex,
            symbol: markerMap.get(seriesData.lineStyle), symbolSize: 8
        },
        {
            name: `${lineName} - PY`, type: 'line',
            data: seriesData?.metric?.previous?.[0]?.primaryAxis,
            color: pyColor, symbolSize: 8, itemStyle: { opacity: 0 },
            coordinateSystem: 'cartesian2d'
        },
        {
            name: `${lineName} - PY`, type: 'line',
            data: seriesData?.metric?.previous?.[1]?.secondaryAxis,
            symbolSize: 8, itemStyle: { opacity: 0 }, color: pyColor,
            coordinateSystem: 'cartesian2d', yAxisIndex: yAxisIndex,
        }
    ];
}

function createTargetSeries(seriesData, lineName, yAxisIndex = 0) {
    return [
        {
            name: lineName, type: 'scatter',
            data: seriesData?.Target?.current?.[0]?.primaryAxis,
            color: "green", tooltip: { formatter: params => `week: ${params.name}, value: ${params.value}` },
            symbol: 'triangle', symbolSize: 10, coordinateSystem: 'cartesian2d'
        },
        {
            name: lineName, type: 'scatter',
            data: seriesData?.Target?.current?.[1]?.secondaryAxis,
            symbol: 'triangle', symbolSize: 10, color: "green",
            coordinateSystem: 'cartesian2d', yAxisIndex: yAxisIndex,
        }
    ];
}

function extractSeriesData(seriesData, axisType, cyOrPy, index, metricType) {
    const data = seriesData?.[metricType]?.[axisType]?.[index]?.[cyOrPy + "Axis"]
                 ?.filter(item => typeof item === 'number' && item !== undefined && !isNaN(item));
    return data || [];
}

function setAxisOptions(axisData) {
    if (!axisData || axisData.length === 0) return { min: 0, max: 100, interval: 20 }; // Default if no data
    const minVal = Math.min(...axisData);
    const maxVal = Math.max(...axisData);
    const range = niceNum(maxVal - minVal, false) || 1; // Ensure range is not zero
    const tickSpacing = niceNum(range / 5, true) || range / 5;
    let min = Math.floor(minVal / tickSpacing) * tickSpacing;
    let max = Math.ceil(maxVal / tickSpacing) * tickSpacing;

    if (min === max) { // Handle case where all data points are the same
        min = minVal - tickSpacing;
        max = maxVal + tickSpacing;
    }
    if (max - min === 0) { // if still same after adjustment (e.g. tickSpacing is 0)
        max = min + 1; // Ensure there is some range
    }

    let interval = niceNum((max - min) / 5, true); // Recalculate interval based on potentially adjusted min/max

     // Further adjustments if min/max are too close to data extent
    if (minVal - min < interval * 0.10 && interval > 0) {
        min -= interval;
    }
    if (max - maxVal < interval * 0.10 && interval > 0) {
        max += interval;
    }
    // Final interval calculation
    interval = niceNum((max - min) / 5, true) || (max - min) / 5 || 1;


    return { min, max, interval };
}

function createYAxisOptions(subData, primaryOptions, secondaryOptions) {
    const yAxes = [{
        splitNumber: 5, // Adjusted for potentially more ticks from niceNum
        splitLine: { show: true, lineStyle: { type: 'dashed', color: '#eee' } }, // Softer grid lines
        axisLabel: {
            formatter: value => dataLabelFormatter(subData.yScale, value, true),
            color: '#058DC7' // Primary axis color
        },
        position: 'left', type: 'value',
        min: primaryOptions.min, max: primaryOptions.max, interval: primaryOptions.interval
    }];

    if (subData.axes == 2 && secondaryOptions && (secondaryOptions.min !== undefined && secondaryOptions.max !== undefined)) {
        yAxes.push({
            splitNumber: 5,
            splitLine: { show: false }, // Often hide secondary axis grid lines or make them different
            axisLabel: {
                formatter: value => dataLabelFormatter(subData.yScaleSecondary || subData.yScale, value, true), // Allow secondary scale
                color: '#ED561B' // Secondary axis color
            },
            position: 'right', type: 'value',
            min: secondaryOptions.min, max: secondaryOptions.max, interval: secondaryOptions.interval
        });
    }
    return yAxes;
}

function niceNum(range, round) {
    if (range === 0) return 0;
    var exponent; /** exponent of range */
    var fraction; /** fractional part of range */
    var niceFraction; /** nice, rounded fraction */

    exponent = Math.floor(Math.log10(range));
    fraction = range / Math.pow(10, exponent);

    if (round) {
        if (fraction < 1.5) niceFraction = 1;
        else if (fraction < 3) niceFraction = 2;
        else if (fraction < 7) niceFraction = 5;
        else niceFraction = 10;
    } else {
        if (fraction <= 1) niceFraction = 1;
        else if (fraction <= 2) niceFraction = 2;
        else if (fraction <= 5) niceFraction = 5;
        else niceFraction = 10;
    }
    return niceFraction * Math.pow(10, exponent);
}

// Ensure Swal configurations are defined
function swalConfigForCopyPopup(message) {
    return {
        title: "Copy this URL to share your WBR report.",
        confirmButtonText: "COPY & CLOSE",
        html: `<p>Your report is available at:</p><input type="text" value="${message}" id="shareableLinkInput" class="form-control" readonly><p class="mt-2"><small>Click the button to copy the link.</small></p>`,
        showCancelButton: false, // Simpler popup
        didOpen: () => {
            const input = Swal.getPopup().querySelector('#shareableLinkInput');
            input.select();
            input.setSelectionRange(0, 99999); // For mobile devices
        },
        preConfirm: () => {
            const input = Swal.getPopup().querySelector('#shareableLinkInput');
            navigator.clipboard.writeText(input.value).then(() => {
                Swal.showValidationMessage('Link copied!'); // Temporary message
            }).catch(err => {
                Swal.showValidationMessage(`Could not copy: ${err}`);
            });
            return false; // Prevent closing immediately to show validation message
        },
        allowOutsideClick: true, // Allow closing by clicking outside
    };
}

function swalConfigForFailurePopup(message) {
    return {
        icon: 'error',
        title: 'Operation Failed',
        text: message,
        showConfirmButton: true, // Allow user to acknowledge
        confirmButtonText: "OK",
        allowOutsideClick: true,
    };
}
    file.text()
        .then(value => {
            var data = JSON.parse(value);
            initialWBRPage.style.display = "none";
            allCharts = data;
            createDynamicElements();
            data.forEach(chart => drawCharts(chart));
        })
        .catch(error => {
            console.log("Something went wrong" + error);
        });
    clearInputFile(jsonInput);
});

document.getElementById('showPassword').onclick = function () {
    this.checked ? document.getElementById('password').type = "text" : document.getElementById('password').type = "password";
};

// add event listener
input.addEventListener('click', () => {
    uploadFile(dataInput.files[0], configInput.files[0]);
    clearInputFile(dataInput);
    clearInputFile(configInput);
    leftNavBtn.click();
    dataInputLabel.innerText = "";
    dataInputLabel.appendChild(strongElementCSV);
    dataInputLabel.appendChild(smallElementCSV);
    configInputLabel.innerText = "";
    configInputLabel.appendChild(strongElementYAML);
    configInputLabel.appendChild(smallElementYAML);
});

const uploadFile = async (data, config) => {
    const page_loader_div = document.createElement('div');
    page_loader_div.id = "page_loader_div";
    page_loader_div.className = "loader";
    document.getElementsByTagName('body')[0].appendChild(page_loader_div);

    const formdata = new FormData();
    formdata.append("configfile", config, "WBR-Sample-Dataset.yaml");
    formdata.append("csvfile", data, "WBR Sample Dataset.csv");

    const requestOptions = {
        method: 'POST',
        body: formdata,
        redirect: 'follow'
    };

    const fetchText = async () => {
        try {
            const response = await fetch("/get-wbr-metrics", requestOptions);
            const loaderDiv = document.getElementById("page_loader_div");
            if (response.status === 200) {
                if (loaderDiv) loaderDiv.remove();
                if (initialWBRPage) initialWBRPage.style.display = "none";
                const data = await response.json();
                allCharts.push(data);
                createDynamicElements();
                drawCharts(data);
            } else {
                if (initialWBRPage) initialWBRPage.style.display = "none";
                if (loaderDiv) loaderDiv.remove();
                const message = await response.json();
                const container_block = document.getElementById('charts');
                const deckDiv = document.createElement('div');
                const titleH2 = document.createElement('h2');
                titleH2.innerHTML = message && message.description;
                titleH2.className = "error-message";
                deckDiv.className = "deckset";
                deckDiv.appendChild(titleH2);
                container_block.appendChild(deckDiv);
            }
        } catch (error) {
            console.error('Fetch error:', error);
            const loaderDiv = document.getElementById("page_loader_div");
            if (loaderDiv) loaderDiv.remove();
            if (initialWBRPage) initialWBRPage.style.display = "none";
            // Optionally, show an error message on the page
            var container_block = document.getElementById('charts');
            var deckDiv = document.createElement('div');
            var titleH2 = document.createElement('h2');
            titleH2.innerHTML = "Failed to build the WBR deck!";
            titleH2.className = "error-message";
            deckDiv.className = "deckset";
            deckDiv.appendChild(titleH2);
            container_block.appendChild(deckDiv);
        }
    };

    fetchText();

}

function createDynamicElements() {
    const dynamicButtonDiv = document.createElement('div');
    dynamicButtonDiv.className = 'no-print dynamic-buttons';
    dynamicButtonDiv.id = "dynamic_buttons";

    createPublishButtonElement(dynamicButtonDiv);
    createJsonButtonElement(dynamicButtonDiv);

    document.getElementsByTagName('body')[0].appendChild(dynamicButtonDiv);
}

async function createJsonButtonElement(dynamicButtonDiv) {
    const jsonButton = document.createElement('button');
    jsonButton.className = 'no-print row btn json-download-button btn-info';
    jsonButton.textContent = "Download JSON";
    jsonButton.title = "Download a JSON version of the WBR deck based on the latest csv data and yaml config";
    jsonButton.id = 'json_download_button';

    try {
        const svgIcon = await fetchSvgIcon('/icons/json.svg');
        jsonButton.appendChild(document.createTextNode(' '));
        jsonButton.appendChild(svgIcon);
    } catch (error) {
        console.error('Error fetching SVG icon:', error);
    }

    dynamicButtonDiv.appendChild(jsonButton);

    jsonButton.addEventListener('click', () => {
        const blob = new Blob([JSON.stringify(allCharts, null, 2)], { type: 'application/json' });
        const a = document.createElement("a");
        a.href = window.URL.createObjectURL(blob);
        a.download = "wbr.json";
        a.click();
    });
}

async function createPublishButtonElement(dynamicButtonDiv) {
    const publishButton = document.createElement('button');
    publishButton.className = 'no-print row btn publish-button btn-info';
    publishButton.textContent = "Publish";
    publishButton.title = "Publish the report to a web, a link will be provided which can be then used to generate the same report without any config or data files";
    publishButton.id = 'publishToWeb';
    publishButton.dataset.target = "#publishModal";

    try {
        const svgIcon = await fetchSvgIcon('/icons/publish.svg');
        publishButton.appendChild(document.createTextNode(' '));
        publishButton.appendChild(svgIcon);
    } catch (error) {
        console.error('Error fetching SVG icon:', error);
    }

    dynamicButtonDiv.appendChild(publishButton);

    // Remaining event listener code unchanged
    const submitButton = document.getElementById('submit');
    const checkBox = document.getElementById("data0");
    const passText = document.getElementById("pass_text");
    const showPass = document.getElementById('showPassword');
    const showPassLabel = document.getElementById('showPassword_Text');
    const passwordField = document.getElementById("password");

    publishButton.addEventListener('click', () => {
        $("#publishModal").modal('toggle');
        passText.style.display = "none";
        showPass.style.display = "none";
        showPassLabel.style.display = "none";
        passwordField.style.display = "none";
        submitButton.disabled = false;
        passwordGlobal = "";
    });

    checkBox.addEventListener('change', () => {
        if (checkBox.checked) {
            passwordField.type = "password";
            submitButton.disabled = true;
            showPasswordFields(true);
            passwordField.addEventListener('input', () => {
                submitButton.disabled = passwordField.value === "";
                if (!submitButton.disabled) {
                    passwordGlobal = passwordField.value;
                }
            });
        } else {
            showPasswordFields(false);
            passwordField.value = "";
            submitButton.disabled = false;
            passwordGlobal = "";
        }
    });

    submitButton.addEventListener('click', async () => {
        const requestOptions = {
            method: 'POST',
            body: JSON.stringify(allCharts),
            redirect: 'follow',
            headers: {
                'Content-Type': 'application/json'
            }
        };

        const url = passwordGlobal === "" ? "/publish-wbr-report" : `/publish-protected-report?password=${passwordGlobal}`;

        try {
            const response = await fetch(url, requestOptions);
            if (response.ok) {
                const jsonResponse = await response.json();
                Swal.fire(swalConfigForCopyPopup(jsonResponse.path));
            } else {
                Swal.fire(swalConfigForFailurePopup("Failed to publish the report!"))
            }
        } catch (error) {
            console.error('Error publishing report:', error);
        }
    });
}

async function fetchSvgIcon(url) {
    const response = await fetch(url);
    const svgText = await response.text();
    const svgElement = document.createElement('div');
    svgElement.innerHTML = svgText;
    return svgElement.firstElementChild;
}

function showPasswordFields(show) {
    const elementsToToggle = [
        document.getElementById("pass_text"),
        document.getElementById("showPassword"),
        document.getElementById("showPassword_Text"),
        document.getElementById("password")
    ];

    elementsToToggle.forEach(element => {
        element.style.display = show ? "block" : "none";
    });
}

function swalConfigForCopyPopup(message) {
    return {
        title: "Copy this URL and share it with with those who need to view the WBR report.",
        confirmButtonText: "COPY",
        html: message,
        showCancelButton: true,
        cancelButtonColor: "#6c757d",
        didOpen: () => {
            Swal.getPopup().addEventListener('click', () => {
                navigator.clipboard.writeText(Swal.getHtmlContainer().innerText)
            })
        },
        allowOutsideClick: false,
        allowEscapeKey: false,
        preConfirm: () => {
            return false; // Prevent confirmed
        }
    }
}

function swalConfigForFailurePopup(message) {
    return {
        title: message,
        showConfirmButton: false,
        showCancelButton: true,
        cancelButtonColor: "#6c757d",
        cancelButtonText: "Close",
        allowOutsideClick: false,
        allowEscapeKey: false,
        preConfirm: () => {
            return false; // Prevent confirmed
        }
    }
}

function clearInputFile(f) {
    if (f !== undefined && f.value) {
        try {
            f.value = ''; //for IE11, latest Chrome/Firefox/Opera...
        } catch (err) { }

        if (f.value) { //for IE5 ~ IE10
            var form = document.createElement('form'),
                parentNode = f.parentNode, ref = f.nextSibling;
            form.appendChild(f);
            form.reset();
            parentNode.insertBefore(f, ref);
        }
    }
}

async function downloadFile(csvDataFile) {
    var formdata = new FormData();
    formdata.append("csvfile", csvDataFile, "WBR Sample Dataset.csv");

    var requestOptions = {
        method: 'POST',
        body: formdata,
    };
    try {
        fetch("/download_yaml", requestOptions)
            .then((res) => {
                yaml_loader.style.display = "none";
                return res.blob();
            })
            .then((data) => {
                var a = document.createElement("a");
                a.href = window.URL.createObjectURL(data);
                a.download = "wbr_config.yaml";
                a.click();
            });
    } catch (error) {
        console.error('There was a problem with the fetch operation:', error);
    }
};

function createTitle(data) {
    const titleDiv = document.createElement('div');
    titleDiv.className = 'titleDiv'; // Use a class instead of inline style
    const titleH2 = document.createElement('h3');
    titleH2.innerHTML = `${data.title} (Week Ending ${data.weekEnding})`;
    titleH2.className = 'title';
    titleDiv.appendChild(titleH2);
    return titleDiv;
}

function createMainDiv() {
    const maindiv = document.createElement('div');
    const counterDiv = document.createElement('div');
    counterDiv.className = 'counterdiv';
    maindiv.appendChild(counterDiv);
    return maindiv;
}

function createSection(subData, deckDiv) {
    const sectionDivId = `charDiv_${Math.random()}`;
    const sectionDiv = document.createElement('div');
    sectionDiv.id = sectionDivId;
    sectionDiv.className = 'sectionDiv';
    deckDiv.appendChild(sectionDiv);

    if (subData.plotStyle === 'section') {
        plotSection(sectionDivId, subData);
    } else {
        displayEmbeddedContent(sectionDivId, subData);
    }
}

function createChartBlock(subData, deckDiv, counter) {
    const chartId = `charDiv_${Math.random()}`;
    const block_to_insert = document.createElement('div');
    block_to_insert.id = chartId;
    block_to_insert.className = 'chartdiv';

    const table_block = document.createElement('div');
    table_block.id = `${chartId}_table`;
    table_block.className = 'tablediv';

    const maindiv = createMainDiv();
    maindiv.className = 'maindiv';
    maindiv.appendChild(block_to_insert);
    maindiv.appendChild(table_block);

    deckDiv.appendChild(maindiv);
    plotChart(chartId, subData, counter);
    createTable(`${chartId}_table`, subData);
}

function createSixWeeksTable(subData, deckDiv, tableId, counter) {
    const blockTableDivId = `charDiv_${Math.random()}`;
    const table_block_to_insert = document.createElement('div');
    table_block_to_insert.id = blockTableDivId;
    table_block_to_insert.className = 'blockTableDiv';

    const maindiv = createMainDiv();
    maindiv.className = 'maindivTable';
    maindiv.appendChild(table_block_to_insert);

    deckDiv.appendChild(maindiv);
    plotSixWeeksTable(blockTableDivId, subData, tableId, counter);
}

function createTwelveMonthsTable(subData, deckDiv, tableId, counter) {
    const blockTableDivId = `charDiv_${Math.random()}`;
    const table_block_to_insert = document.createElement('div');
    table_block_to_insert.id = blockTableDivId;
    table_block_to_insert.className = 'blockTableDiv';

    const maindiv = createMainDiv();
    maindiv.className = 'maindivTable';
    maindiv.appendChild(table_block_to_insert);

    deckDiv.appendChild(maindiv);
    plotTwelveMonthsTable(blockTableDivId, subData, tableId, counter);
}

function drawCharts(data) {
    const container_block = document.getElementById('charts');
    const deckDiv = document.createElement('div');
    deckDiv.className = 'deckset';

    const titleDiv = createTitle(data);
    deckDiv.appendChild(titleDiv);
    container_block.appendChild(deckDiv);

    let counter = data.blockStartingNumber;
    let tableId = 0;

    data.blocks.forEach((subData) => {
        switch (subData.plotStyle) {
            case 'section':
            case 'embedded_content':
                createSection(subData, deckDiv);
                break;
            case '6_12_chart':
                createChartBlock(subData, deckDiv, counter);
                counter++;
                break;
            case '6_week_table':
                tableId++;
                createSixWeeksTable(subData, deckDiv, tableId, counter);
                counter++;
                break;
            case '12_MonthsTable':
                tableId++;
                createTwelveMonthsTable(subData, deckDiv, tableId, counter);
                counter++;
                break;
        }
    });
}

function getLabel(mask, addLabel) {
    return addLabel ? labelMap.get(mask) : "";
}

function dataLabelFormatter(formatMask, value, addLabel) {
    let precision = 0
    let formatted = value;
    if (formatMask.includes(".")) {
        precision = formatMask.split(".")[1][0]
    }
    if (formatMask.includes("MM")) {
        formatted = ((value / 1000000).toFixed(precision)) + getLabel("MM", addLabel);
    } else if (formatMask.includes("BB")) {
        formatted = ((value / 1000000000).toFixed(precision)) + getLabel("BB", addLabel);
    } else if (formatMask.includes("KK")) {
        formatted = ((value / 1000).toFixed(precision)) + getLabel("KK", addLabel);
    } else if (formatMask.includes("bps")) {
        formatted = ((value * 10000).toFixed(precision)) + getLabel("bps", addLabel);
    } else if (formatMask.includes("%")) {
        formatted = ((value * 100).toFixed(precision)) + getLabel("%", addLabel);
    } else {
        formatted = value.toFixed(precision);
    }
    return formatted;
}

function createSeries(subData, seriesData, lineName, cyColor, pyColor, yAxisIndex = 0) {
    return [
        {
            name: `${lineName} - CY`,
            type: 'line',
            smooth: true,
            label: { show: true, formatter: params => dataLabelFormatter(subData.yScale, params.value) },
            color: cyColor,
            symbol: markerMap.get(seriesData.lineStyle),
            symbolSize: 8,
            data: seriesData && seriesData.metric && seriesData.metric.current[0] && seriesData.metric.current[0].primaryAxis,
            coordinateSystem: 'cartesian2d'
        },
        {
            name: `${lineName} - CY`,
            type: 'line',
            smooth: true,
            label: { show: true, formatter: params => dataLabelFormatter(subData.yScale, params.value) },
            data: seriesData && seriesData.metric && seriesData.metric.current[1] && seriesData.metric.current[1].secondaryAxis,
            color: cyColor,
            coordinateSystem: 'cartesian2d',
            yAxisIndex: yAxisIndex,
            symbol: markerMap.get(seriesData.lineStyle),
            symbolSize: 8
        },
        {
            name: `${lineName} - PY`,
            type: 'line',
            data: seriesData && seriesData.metric && seriesData.metric.previous[0] && seriesData.metric.previous[0].primaryAxis,
            color: pyColor,
            symbolSize: 8,
            itemStyle: { opacity: 0 },
            coordinateSystem: 'cartesian2d'
        },
        {
            name: `${lineName} - PY`,
            type: 'line',
            data: seriesData && seriesData.metric && seriesData.metric.previous[1] && seriesData.metric.previous[1].secondaryAxis,
            symbolSize: 8,
            itemStyle: { opacity: 0 },
            color: pyColor,
            coordinateSystem: 'cartesian2d',
            yAxisIndex: yAxisIndex,
        }
    ];
}

function createTargetSeries(seriesData, lineName, yAxisIndex = 0) {
    return [
        {
            name: lineName,
            type: 'scatter',
            data: seriesData && seriesData.Target && seriesData.Target.current[0] && seriesData.Target.current[0].primaryAxis,
            color: "green",
            tooltip: { formatter: params => `week: ${params.name}, value: ${params.value}` },
            symbol: 'triangle',
            symbolSize: 10,
            coordinateSystem: 'cartesian2d'
        },
        {
            name: lineName,
            type: 'scatter',
            data: seriesData && seriesData.Target && seriesData.Target.current[1] && seriesData.Target.current[1].secondaryAxis,
            symbol: 'triangle',
            symbolSize: 10,
            color: "green",
            coordinateSystem: 'cartesian2d',
            yAxisIndex: yAxisIndex,
        }
    ];
}

function extractSeriesData(seriesData, axisType, cyOrPy, index, metricType) {
    const data = seriesData && seriesData[metricType] && seriesData[metricType][axisType] && seriesData[metricType][axisType][index] &&
        seriesData[metricType][axisType][index][cyOrPy + "Axis"].filter(item => typeof item === 'number' && item !== undefined && !isNaN(item));
    return data ? data : [];
}

function setAxisOptions(axisData) {
    const minVal = Math.min(...axisData);
    const maxVal = Math.max(...axisData);
    const range = niceNum(maxVal - minVal, false);
    const tickSpacing = niceNum(range / 5, true);
    let min = Math.floor(minVal / tickSpacing) * tickSpacing;
    let max = Math.ceil(maxVal / tickSpacing) * tickSpacing;
    let interval = (max - min) / 5;

    if (minVal - min < interval * 0.10) {
        min -= interval;
        interval = (max - min) / 5;
    }
    if (max - maxVal < interval * 0.10) {
        max += interval;
        interval = (max - min) / 5;
    }

    return {
        min, max, interval
    };
}

function createYAxisOptions(subData, primaryOptions, secondaryOptions) {
    return [
        {
            splitNumber: 4,
            splitLine: { show: false },
            gridIndex: 0,
            axisLabel: {
                formatter: value => dataLabelFormatter(subData.yScale, value, true),
                color: '#058DC7'
            },
            position: 'left',
            type: 'value',
            min: primaryOptions.min,
            max: primaryOptions.max,
            interval: primaryOptions.interval
        },
        {
            splitNumber: 4,
            axisLabel: {
                formatter: value => dataLabelFormatter(subData.yScale, value, true),
                color: '#ED561B'
            },
            position: 'right',
            type: 'value',
            min: secondaryOptions.min,
            max: secondaryOptions.max,
            interval: secondaryOptions.interval
        }
    ];
}


function plotChart(divId, subData, counter) {
    var subseries = [];
    var primaryAxis = [];
    var secondayAxis = [];
    subData.yAxis.forEach(seriesData => {

        var lineName = seriesData.legendName;

        if (seriesData.lineStyle === undefined) {
            return;
        }

        if (seriesData.lineStyle !== "target") {

            if (subData.axes == 2) {
                primaryAxis.push(...extractSeriesData(seriesData, "current", "primary", 0, "metric"));
                primaryAxis.push(...extractSeriesData(seriesData, "previous", "primary", 0, "metric"));
                secondayAxis.push(...extractSeriesData(seriesData, "current", "secondary", 1, "metric"));
                secondayAxis.push(...extractSeriesData(seriesData, "previous", "secondary", 1, "metric"));
                subseries.push(createSeries(subData, seriesData, lineName, cyColorMap.get(seriesData.lineStyle), pyColorMap.get(seriesData.lineStyle), 1));
            }
            else if (subData.axes == 1) {
                primaryAxis.push(...extractSeriesData(seriesData, "current", "primary", 0, "metric"));
                primaryAxis.push(...extractSeriesData(seriesData, "previous", "primary", 0, "metric"));
                primaryAxis.push(...extractSeriesData(seriesData, "current", "secondary", 1, "metric"));
                primaryAxis.push(...extractSeriesData(seriesData, "previous", "secondary", 1, "metric"));
                subseries.push(createSeries(subData, seriesData, lineName, cyColorMap.get(seriesData.lineStyle), pyColorMap.get(seriesData.lineStyle), 0));
            }

        } else {

            if (subData.axes == 2) {
                primaryAxis.push(...extractSeriesData(seriesData, "current", "primary", 0, "Target"));
                secondayAxis.push(...extractSeriesData(seriesData, "current", "secondary", 1, "Target"));

                subseries.push(createTargetSeries(seriesData, lineName, 1));
            }
            else if (subData.axes == 1) {
                primaryAxis.push(...extractSeriesData(seriesData, "current", "primary", 0, "Target"));
                primaryAxis.push(...extractSeriesData(seriesData, "current", "secondary", 1, "Target"));

                subseries.push(createTargetSeries(seriesData, lineName, 0));
            }

        }
    });

    const primaryAllData = [].concat(...primaryAxis).filter(item => item !== undefined && !isNaN(item));
    const secondaryAllData = [].concat(...secondayAxis).filter(item => item !== undefined && !isNaN(item));

    const primaryOptions = setAxisOptions(primaryAllData);
    const secondaryOptions = setAxisOptions(secondaryAllData);

    const chartDom = document.getElementById(divId);
    const myChart = echarts.init(chartDom, null, { renderer: 'svg' });

    const resizeObserver = new ResizeObserver(() => {
        myChart.resize();
    });

    resizeObserver.observe(chartDom);

    const option = {
        title: {
            text: counter + ". " + subData.title,
            left: 'center'
        },
        tooltip: {
            show: (subData.tooltip == 'true'),
            formatter: function (params) {
                var tooltipValue = dataLabelFormatter(subData.yScale, params.value, true);
                return '<b>' + params.name + '<b>: ' + '<b>' + tooltipValue + '</b>';
            }
        },
        xAxis: {
            type: 'category',
            data: subData && subData.xAxis,
            axisLabel: {
                interval: 0,
                rotate: 30 //If the label names are too long you can manage this by rotating the label.
            },
            position: 'bottom',
            axisLine: {
                onZero: false
            }
        },
        yAxis: createYAxisOptions(subData, primaryOptions, secondaryOptions),
        legend: {
            left: 'center',
            top: 'bottom',
            itemWidth: 16,
            itemHeight: 10,
            itemGap: 4
        },
        series: subseries.flat(),
    }
    myChart.setOption(option);
}

function niceNum(range, round) {
    var exponent; /** exponent of range */
    var fraction; /** fractional part of range */
    var niceFraction; /** nice, rounded fraction */

    exponent = Math.floor(Math.log10(range));
    fraction = range / Math.pow(10, exponent);

    if (round) {
        if (fraction < 1.5)
            niceFraction = 1;
        else if (fraction < 3)
            niceFraction = 2;
        else if (fraction < 7)
            niceFraction = 5;
        else
            niceFraction = 10;
    } else {
        if (fraction <= 1)
            niceFraction = 1;
        else if (fraction <= 2)
            niceFraction = 2;
        else if (fraction <= 5)
            niceFraction = 5;
        else
            niceFraction = 10;
    }

    return niceFraction * Math.pow(10, exponent);
}

function createTable(dynamicTable, subData) {
    boxTotals.push(subData);

    const { tableHeader: header, tableBody: body } = subData.table;

    // Create a table element.
    const table = document.createElement("table");

    // Create table header row.
    const headerRow = table.insertRow(-1);
    header.forEach(headerText => {
        const th = document.createElement("th");
        th.innerHTML = headerText;
        th.style.width = '98px';
        headerRow.appendChild(th);
    });

    // Helper function to format cell data.
    const formatCellData = (data, index) => {
        if (data === "N/A") return data;

        const { yScale: formatMask, boxTotalScale: boxTotalMask } = subData;
        let precision = 0;
        if (formatMask.includes(".")) {
            precision = formatMask.split(".")[1][0];
        }

        if ((index === 1 || index % 2 === 0) && index !== 0) {
            if (boxTotalMask.includes("bps")) {
                return Math.round(data) + "bps";
            } else {
                return parseFloat(data).toFixed(precision) + "%";
            }
        } else {
            return dataLabelFormatter(formatMask, data, true);
        }
    };

    // Create table body rows.
    body.forEach(rowData => {
        const row = table.insertRow(-1);
        rowData.forEach((cellData, index) => {
            const cell = row.insertCell(-1);
            cell.innerHTML = formatCellData(cellData, index);
        });
    });

    // Add the newly created table to the container.
    const divShowData = document.getElementById(dynamicTable);
    divShowData.innerHTML = "";
    divShowData.appendChild(table);
}

// Function to format cell data
const formatCellData = (value, formatMask, precision) => {
    if (value === " " || value === null || value === undefined) return value; // Handle null or undefined as well

    if (!formatMask) { // If no formatMask, return value formatted to precision or as is
        if (typeof value === 'number') {
            return value.toFixed(precision || 0); // Default to 0 precision if not specified
        }
        return String(value);
    }

    if (formatMask.includes("MM")) {
        return (Number(value) / 1000000).toFixed(precision) + "M";
    }
    else if (formatMask.includes("BB") || (typeof value === 'number' && value >= 1E9 && value < 1E12 && !formatMask.includes("MM"))) { // Ensure BB takes precedence if applicable
        return (Number(value) / 1000000000).toFixed(precision) + "B";
    }
    else if (formatMask.includes("KK")) {
        return (Number(value) / 1000).toFixed(precision) + "K";
    }
    else if (formatMask.includes("bps")) {
        return (Number(value) * 10000).toFixed(precision) + "bps";
    }
    else if (formatMask.includes("%")) {
        return (Number(value) * 100).toFixed(precision) + "%";
    }
    else {
        return parseFloat(value).toFixed(precision)
    }
};

function plotSixWeeksTable(divId, subData, tableId, counter) {
    // Create table element
    const table = document.createElement('table');
    table.id = tableId;
    table.classList.add('table', 'table-sm');
    table.border = '1';

    // Create title row
    const titleRow = table.insertRow(-1);
    const titleTh = document.createElement('th');
    titleTh.colSpan = 10;
    titleTh.className = "tableTitle";
    titleTh.textContent = `${counter}. ${subData.title}`;
    titleRow.appendChild(titleTh);

    // Create header row
    const headerRow = table.insertRow(-1);
    headerRow.appendChild(document.createElement('th')); // Empty top-left corner cell
    subData.headers.forEach(headerText => {
        const th = document.createElement('th');
        th.textContent = headerText;
        headerRow.appendChild(th);
    });

    // Add data to tables list for later use
    tablesList.push(subData);

    // Create data rows
    subData.rows.forEach(row => {
        const dataRow = table.insertRow(-1);
        dataRow.classList.add('blockTable');

        // Row header
        const headerCell = document.createElement('td');
        headerCell.textContent = row.rowHeader;
        headerCell.style.cssText = row.rowStyle;
        dataRow.appendChild(headerCell);

        // Row data cells
        const formatMask = row.yScale;
        const precision = formatMask.includes(".") ? formatMask.split(".")[1][0] : 0;

        if (row.rowData.length === 0) {
            subData.headers.forEach(() => {
                const emptyCell = document.createElement('td');
                emptyCell.style.cssText = row.rowStyle;
                emptyCell.classList.add('rowData');
                emptyCell.textContent = "";
                dataRow.appendChild(emptyCell);
            });
        } else {
            row.rowData.forEach(cellData => {
                const dataCell = document.createElement('td');
                dataCell.classList.add('rowData');
                dataCell.textContent = formatCellData(cellData, formatMask, precision);
                dataRow.appendChild(dataCell);
            });
        }
    });

    // Append table to div
    const divShow = document.getElementById(divId);
    divShow.innerHTML = "";
    divShow.appendChild(table);

    // Adjust height if necessary
    if (divShow.offsetHeight < divShow.scrollHeight) {
        divShow.style.height = "100%";
    }
}

function displayEmbeddedContent(divId, subData) {
    const divShow = document.getElementById(divId);

    // Create iframe element
    const iframe = document.createElement("iframe");
    iframe.id = subData.id;
    iframe.src = subData.source;
    iframe.title = subData.title;
    iframe.setAttribute("aria-label", subData.title);
    iframe.setAttribute("scrolling", "yes");
    iframe.setAttribute("frameborder", "1");

    // Set width and height based on conditions
    const bodyWidth = document.body.clientWidth;
    const bodyHeight = document.body.clientHeight;

    iframe.setAttribute("width", subData.width > bodyWidth ? "100%" : subData.width);
    iframe.setAttribute("height", subData.height > bodyHeight ? bodyHeight : subData.height);

    // Append iframe to the specified div
    divShow.innerHTML = "";
    divShow.appendChild(iframe);
}

function plotTwelveMonthsTable(divId, subData, tableId, counter) {
    // Create table element
    var table = document.createElement('table');
    table.setAttribute("id", tableId);
    table.classList.add('table', 'table-sm');
    table.border = '1';

    // Create title row
    var titleTh = document.createElement('th');
    titleTh.colSpan = 13; // Adjusted colspan based on the number of columns
    titleTh.textContent = counter + ". " + subData.title;
    titleTh.className = "tableTitle";
    var titleTr = document.createElement('tr');
    titleTr.appendChild(titleTh);
    table.appendChild(titleTr);

    // Create header row
    var headerTr = document.createElement('tr');
    var emptyHeaderCell = document.createElement('th');
    headerTr.appendChild(emptyHeaderCell);

    subData.headers.forEach(function (headerText) {
        var th = document.createElement('th');
        th.textContent = headerText;
        headerTr.appendChild(th);
    });
    table.appendChild(headerTr);

    // Create data rows
    subData.rows.forEach(function (row) {
        var dataTr = document.createElement('tr');
        dataTr.className = 'blockTable';

        // Create row header cell
        var headerTd = document.createElement('td');
        headerTd.textContent = row.rowHeader;
        headerTd.style.cssText = row.rowStyle;
        dataTr.appendChild(headerTd);

        // Create data cells
        row.rowData.forEach(cellData => {
            var td = document.createElement('td');
            var formatMask = row.yScale;
            const precision = formatMask.includes(".") ? formatMask.split(".")[1][0] : 0;
            td.textContent = formatCellData(cellData, formatMask, precision);
            td.className = "rowData";
            dataTr.appendChild(td);
        });

        table.appendChild(dataTr);
    });

    // Append table to the specified div
    var divShow = document.getElementById(divId);
    divShow.innerHTML = "";
    tablesList.push(subData);
    divShow.appendChild(table);

    // Adjust div height if overflow
    if (divShow.offsetHeight < divShow.scrollHeight) {
        divShow.style.cssText = "height: 100%; !important";
    }
}


function plotSection(sectionDivId, subData) {
    var div = document.createElement('div');
    div.classList.add('section_div');

    var h3 = document.createElement('h3');
    var text = document.createTextNode(subData.title);
    h3.appendChild(text);

    div.appendChild(h3);

    var divShow = document.getElementById(sectionDivId);
    divShow.innerHTML = "";
    divShow.appendChild(div)
}
