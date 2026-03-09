# Social Simulation Platform Operation Tutorial

## 1. Document Introduction

### 1.1 Document Purpose

This document is the standardized operation tutorial for the Social Simulation Online Platform. It aims to provide clear and detailed step-by-step guidance for platform users, helping users quickly master platform access, login, core feature usage, and common operation techniques, ensuring standardized and efficient completion of various simulation experiment operations.

### 1.2 Target Audience

This tutorial is suitable for all users of the social simulation platform (including new users and daily users). No professional technical background is required - simply follow the steps to proficiently use the platform's core features.

### 1.3 Platform Overview

This platform is an online social simulation tool that requires no client download or installation - it can be accessed directly through a browser. Core features include simulation scene creation, agent configuration, simulation execution and observation, template management, data export, and AI analysis, meeting various social simulation experiment needs.

## 2. Preparation

### 2.1 Environment Requirements (Online Platform Adaptation)

To ensure normal platform operation, the following browser and device requirements must be met. No additional software installation is required:

- **Browser**: Google Chrome 100.0+ or Microsoft Edge 100.0+ are recommended. IE browser is not recommended (may cause functional issues).
- **Device**: Desktop computer, laptop, or tablet. Computer operation is preferred (better convenience and compatibility).
- **Network**: A stable internet connection is required (wired or wireless). Avoid network interruptions during operation.

### 2.2 Account and Access Preparation

Account registration must be completed before accessing the platform: After entering the platform's official access address, click the "Register" button, fill in the organization, email, username and other information as prompted, set your personal account password, and complete registration to obtain access permissions.

**Special Note**: This project does not currently support password recovery. Please remember your account and password carefully to avoid being unable to log in due to a forgotten password.

### 2.3 Large Model Configuration

Navigate to **Configuration** -> **LLM providers** from the left/top menu.

**Option 1: Directly Call Official API (Requires Stable International Network)**

#### Using OpenAI as an Example:

1. Go to the OpenAI API keys page at https://auth.openai.com/log-in and create your API Key.
2. On this platform's configuration page, click "Add provider".
3. Fill in the following information:
   - **Label**: Custom, e.g., My-OpenAI
   - **Provider**: Select OpenAI
   - **API key**: Paste the API Key you just created
   - **Base URL**: Usually https://api.openai.com/v1
   - **Model**: Enter the model name you plan to use, such as gpt-4o-mini or gpt-4-turbo
4. Save and click "Test connectivity" to verify the configuration is successful.

The Gemini (Google AI) configuration process is similar. Obtain an API Key from Google AI Studio at https://aistudio.google.com/api-keys and select Gemini as the provider. Models include gemini-1.5-flash-latest, and usually no Base URL is required.

![Tutorial Screenshot](/uploads/extracted-doc-images/tutorial-img-1.png)

**Option 2: Use API Relay Station (Recommended for Users in Mainland China)**

1. Obtain an API Key and Base URL from your chosen API relay station (such as OpenRouter, DMXAPI, etc.).

#### API Relay Station References (Listed Only, No Endorsement):
- OpenRouter: https://openrouter.ai/
- DMXAPI: https://www.dmxapi.cn/
- V-API: https://api.v3.cm/

2. On this platform's configuration page, click "Add provider".
3. Fill in the following information:
   - **Label**: Custom, e.g., MyRelay
   - **Provider**: Must select OpenAI-compatible
   - **API key**: Paste the API Key provided by the relay station
   - **Base URL**: Paste the Base URL provided by the relay station, such as https://openrouter.ai/api/v1
   - **Model**: From the relay station's model list, fully copy the model name you want to use and paste it here
4. Save and click "Test connectivity".

![Tutorial Screenshot](/uploads/extracted-doc-images/tutorial-img-2.png)

### 2.4 Configure Search Provider

To enable agents to access external information, you can also configure a search service provider. Navigate to **Configuration** -> **Search providers**.

#### Using Serper as an Example (https://serper.dev/):

1. Go to register an account and get an API Key.
2. On this platform's configuration page, select serper as the provider.
3. Fill in the following information:
   - **API key**: Paste your Serper API Key
   - **Base URL**: Usually https://google.serper.dev/search
4. Save.

The configuration process for other providers like SerpAPI and Tavily is similar. Please obtain the corresponding API Key and Base URL according to their official documentation.

## 3. Quick Start: Beginner's Guide

This section focuses on core operations for beginners, quickly mastering the full process of "registration and login - first simulation - new simulation" without unnecessary steps, efficiently getting started with the platform's basic features.

### 3.1 Launch Your First Simulation

1. After logging in, find the "Launch your first simulation" button on the homepage and click to enter the simulation wizard;
2. Keep the system default settings throughout, click "Next" as prompted on the page without manually modifying any parameters;
3. After the wizard completes, click "Start Simulation" to create your first "simple chat scene" simulation environment;
4. Click the "Advance node" button on the left control panel to start the simulation, and observe agent interactions in the right dialog window to complete your first basic simulation.

### 3.2 Create New Simulation

1. After completing the first simulation, click "New simulation" in the "Resume your work" area of the main interface or in the top navigation bar of the experiment interface;
2. The system automatically calls the LLM API. Wait 1-2 seconds, then it will redirect to the new simulation page;
3. You can choose system preset scenes (7 total, divided into social science and standard simulation categories) or call personal templates to quickly set up a new simulation experiment.

### 3.3 Basic Template Operations

1. **Save Template**: After selecting a system preset scene or custom configuration, click "Save as Template" to save to your personal template library;
2. **Use Template**: When creating a new simulation, switch to the "My Templates" tab, select the target template, and no repeated parameter configuration is needed.

## 4. Case Practice: "Meaning Decay in Policy Communication" Simulation Experiment

Combining the platform's core features, complete a full simulation experiment with the theme of "Meaning Decay in Policy Communication" to master practical operation methods for targeted scenarios, connecting to subsequent experiment conclusion and advanced operations.

### 4.1 Step 1: Experiment Basic Information Settings

1. After clicking "New Simulation" and redirecting to the new simulation page, configure basic information (optional, default values will be used if not set);

![Tutorial Screenshot](/uploads/extracted-doc-images/tutorial-img-3.png)

2. Fill in the experiment name (recommended to match the theme, such as "Meaning Decay in Policy Communication Simulation Experiment");
3. Select simulation duration (such as 120 minutes, 72 hours), click **[Confirm]** to complete configuration.

### 4.2 Step 2: Agent Generation and Configuration

Agents are the core carrier of simulation. The platform supports 3 generation methods, with AI batch generation being the recommended choice for this case. Specific operations are as follows:

**Method 1: Generate from Template Characters (Convenient and Efficient)**

1. Enter the agent configuration page, click "Use Template Agents" to jump to the template character library;
2. Check the characters that fit policy communication (policy publishers, grassroots communicators, ordinary people, etc.), adjust the quantity ratio, and save the configuration.

![Tutorial Screenshot](/uploads/extracted-doc-images/tutorial-img-4.png)

**Method 2: AI Batch Generate Agents (Recommended, Supports Large-Scale Configuration)**

1. Click "AI Batch Generate" to enter the batch configuration interface;
2. Set agent statistical distribution (such as age, occupation ratio), add required distribution dimensions;
3. Configure core initial values (policy awareness, willingness to communicate, etc., with values 0-100) to match the core variables of meaning decay;
4. Enter the total number of agents, click "Start Generating", preview and adjust, then save the configuration.

![Tutorial Screenshot](/uploads/extracted-doc-images/tutorial-img-5.png)

**Method 3: Import Agents (Suitable for Scenarios with Preset Data)**

Fill in agent information as required, ensure consistent format, and complete the import after uploading.

### 4.3 Step 3: Advance Nodes, Execute Simulation Experiment

1. After agent configuration is complete, click "Confirm Create" to complete the experiment scene setup and redirect to the experiment operation interface;
2. Click the "Advance node" button on the left to start the simulation;
3. During the simulation, observe changes in core variables through the data panel on the right, and use the "Filter" function to view various logs and agent metadata;

![Tutorial Screenshot](/uploads/extracted-doc-images/tutorial-img-6.png)

![Tutorial Screenshot](/uploads/extracted-doc-images/tutorial-img-7.png)

4. After the simulation advances to the preset duration or expected effect, you can continue advancing nodes or create branches for comparative experiments.

## 5. Experiment Conclusion and Data Management

After the simulation experiment is completed, complete the review and backup through AI analysis reports, data export, and experiment saving, providing support for subsequent iterative optimization.

### 5.1 AI Analysis Report Generation and Export

1. After the experiment ends, click "Report" at the top to enter the report generation page;
2. Confirm the simulation nodes to be analyzed, click "Generate Report Now", and AI will automatically capture full-process data for analysis;
3. After the report is generated, you can directly view it (including 4 core modules: experiment summary, key turning points, agent behavior analysis, and optimization suggestions);
4. Click "Export" in the upper right corner, select Markdown or JSON format, and export to local storage.

### 5.2 Experiment Data Export and Simulation Saving

1. **Data Export**: Click "Export" at the top, select the logs and agent behavior data to be exported, choose the corresponding format (JSON/Excel/CSV, etc.), and confirm to export locally;
2. **Save Template**: Click "Save as Template" in the upper right area of the experiment interface, customize the save name (recommended theme + time), and confirm to save;
3. **Future Access**: From the "Saved" entry on the main interface, filter for the target experiment, which can be directly accessed, modified, or iterated without rebuilding the scene.

## 6. Advanced Features

After mastering basic operations and case practice, use the following advanced features to deeply explore the diversity of simulation experiments and improve the scientific nature and pertinence of social experiments.

### 6.1 Advanced Feature 1: Design Controlled Experiments

Through controlled experiments, explore the impact of different variables on simulation results. Supports multiple experiment groups, custom intervention items, and counterfactual experiments. Specific operations are as follows:

#### 6.1.1 Specific Operation Steps

1. Enter the simulation interface, find the target node, click "Design experiment";
2. Fill in the experiment name, set 1 or more intervention items (global instructions, agent attribute interventions, environmental event interventions);
3. Set multiple experiment groups. You need to add a branch as a control group (without any intervention items or with a placebo);

![Tutorial Screenshot](/uploads/extracted-doc-images/tutorial-img-8.png)

4. Click "Start Batch Run", and the system will generate independently running nodes that advance in parallel until completion;
5. Enable "Compare mode (Diff)", and the system will automatically generate a comparison report to analyze differences between groups and export for review.

#### 6.1.2 Extended Features and Notes

1. **Extended Features**: Multi-group comparison, counterfactual experiments, DIY intervention combinations to explore multi-variable interaction effects;
2. **Notes**: Clarify experimental hypothesis and single variable, prioritize initial/intermediate nodes as target nodes, and use log filtering during experiments to view data from each group.

### 6.2 Advanced Feature 2: Agent Network Topology Settings

Based on social network analysis theory, configure the agent information propagation network topology to explore the regulatory effect of different network structures on simulation results. Specific operations are as follows:

#### 6.2.1 Specific Operation Steps

1. Enter the simulation interface, click "Social Network Topology" at the top to enable the network editor;

![Tutorial Screenshot](/uploads/extracted-doc-images/tutorial-img-9.png)

2. Select system preset network configurations (random, small-world, scale-free, core-periphery, etc.), or switch to custom configuration;
3. Finely configure core parameters (node degree, edge properties, network density). Custom configuration allows manual drawing of nodes and edges;
4. Click "Generate Network" to confirm the effect, and after "Save topology settings", apply to the agent population;

![Tutorial Screenshot](/uploads/extracted-doc-images/tutorial-img-10.png)

5. Start the simulation and observe propagation efficiency and meaning decay rate under different network structures to analyze regulatory mechanisms.

#### 6.2.2 Extended Features and Notes

1. **Extended Features**: Topology configuration comparison experiments, core node control, dynamic topology adjustment, topology template saving;
2. **Notes**: Follow social network analysis logic, match network complexity with agent quantity, avoid isolated nodes, and ensure parameter settings are reasonable.

### 6.3 Advanced Feature 3: Global Knowledge Base Settings

Build a global knowledge base, import documents and text knowledge for real-time agent interaction, improving simulation realism and assisting policy communication experiments. Specific operations are as follows:

#### 6.3.1 Specific Operation Steps

1. When creating a new simulation during scene configuration, or after starting a simulation, click "Global Knowledge Base" at the top to enter the settings page;

![Tutorial Screenshot](/uploads/extracted-doc-images/tutorial-img-11.png)

2. Import content through two methods: "Upload Documents" or "Add Text Knowledge";
3. During the simulation, you can supplement or modify knowledge base content in real-time without restarting the simulation.

#### 6.3.2 Extended Features and Notes

1. **Extended Features**: Policy knowledge base construction, categorized management, knowledge base comparison experiments, knowledge base template saving;
2. **Notes**: Ensure imported knowledge is accurate and meets platform document format requirements. Make modified content effective in time and back up important knowledge locally. Use the simulation time extension feature with caution as it is still in the testing phase.

## 7. Common Problems and Solutions

This section summarizes common problems and simple solutions that can be handled without contacting technical personnel:

**Problem 1: Platform loading slow/laggy?** Solution: Check network, close extra browser tabs, clear cache and revisit;

**Problem 2: AI batch generation of agents failed?** Solution: Check if statistical distribution and initial value settings are standard, confirm agent quantity is within platform limits, and retry after network stabilizes;

**Problem 3: Simulation node advancement stuck?** Solution: Check network, close extra pages, refresh experiment interface and retry. If the issue persists, contact administrator;

**Problem 4: Network topology settings not taking effect?** Solution: Confirm you clicked "Save topology settings", check if network complexity matches agent quantity, and retry after reconfiguring;

**Problem 5: Knowledge base upload failed?** Solution: Check if document format and size meet requirements, simplify redundant content and re-upload;

**Problem 6: AI analysis report generation failed?** Solution: Confirm simulation ended normally with complete data, refresh page and regenerate;

(To be added: Other common problems and solutions, updated with platform usage scenarios)

## 8. Notes and Operation Standards

1. Do not open multiple identical operation pages simultaneously to avoid data conflicts and operation failures;
2. During critical operations such as simulation running and data import/export, ensure network stability. Do not close or refresh the page midway;
3. Properly safeguard platform simulation data and operation records. Export and backup important data in time;
4. Strictly follow platform usage standards. Do not upload or publish irrelevant content. Violations may result in restricted account permissions;
5. After use, click "Sign Out" in the upper right corner of the homepage. This is especially important on public computers to ensure account security;
6. When conducting targeted experiments such as "Meaning Decay in Policy Communication", plan agent distribution and initial values in advance to improve simulation accuracy;
7. When using AI batch generation for large-scale agents, set quantities reasonably to avoid platform lag and simulation failure;
8. For all advanced operations (controlled experiments, network topology, knowledge base), it is recommended to clarify experimental hypotheses first, then configure parameters step by step.

## 9. Auxiliary Information

If you encounter problems not covered in this tutorial, you can get help through the following methods:

1. Contact platform administrator (to be added: administrator contact information);
2. Check the "Help Center" module on the platform homepage for more detailed feature descriptions;
3. Send question feedback to the platform's official email (to be added: official email), and you will receive a reply within 1-2 working days.
