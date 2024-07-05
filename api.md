# Projects

Types:

- <code><a href="./src/resources/projects/projects.ts">ProjectCreateResponse</a></code>
- <code><a href="./src/resources/projects/projects.ts">ProjectListResponse</a></code>

Methods:

- <code title="post /projects">client.projects.<a href="./src/resources/projects/projects.ts">create</a>({ ...params }) -> ProjectCreateResponse</code>
- <code title="get /projects">client.projects.<a href="./src/resources/projects/projects.ts">list</a>({ ...params }) -> ProjectListResponse</code>

## Commits

Types:

- <code><a href="./src/resources/projects/commits.ts">CommitListResponse</a></code>

Methods:

- <code title="get /projects/{id}/versions">client.projects.commits.<a href="./src/resources/projects/commits.ts">list</a>(id, { ...params }) -> CommitListResponse</code>

## InferencePipelines

Types:

- <code><a href="./src/resources/projects/inference-pipelines.ts">InferencePipelineCreateResponse</a></code>
- <code><a href="./src/resources/projects/inference-pipelines.ts">InferencePipelineListResponse</a></code>

Methods:

- <code title="post /projects/{id}/inference-pipelines">client.projects.inferencePipelines.<a href="./src/resources/projects/inference-pipelines.ts">create</a>(id, { ...params }) -> InferencePipelineCreateResponse</code>
- <code title="get /projects/{id}/inference-pipelines">client.projects.inferencePipelines.<a href="./src/resources/projects/inference-pipelines.ts">list</a>(id, { ...params }) -> InferencePipelineListResponse</code>

# Commits

## TestResults

Types:

- <code><a href="./src/resources/commits/test-results.ts">TestResultListResponse</a></code>

Methods:

- <code title="get /versions/{id}/results">client.commits.testResults.<a href="./src/resources/commits/test-results.ts">list</a>(id, { ...params }) -> TestResultListResponse</code>

# InferencePipelines

## Data

Types:

- <code><a href="./src/resources/inference-pipelines/data.ts">DataStreamResponse</a></code>

Methods:

- <code title="post /inference-pipelines/{id}/data-stream">client.inferencePipelines.data.<a href="./src/resources/inference-pipelines/data.ts">stream</a>(id, { ...params }) -> DataStreamResponse</code>

## TestResults

Types:

- <code><a href="./src/resources/inference-pipelines/test-results.ts">TestResultListResponse</a></code>

Methods:

- <code title="get /inference-pipelines/{id}/results">client.inferencePipelines.testResults.<a href="./src/resources/inference-pipelines/test-results.ts">list</a>(id, { ...params }) -> TestResultListResponse</code>
