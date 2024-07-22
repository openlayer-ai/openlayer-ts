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

- <code title="get /projects/{projectId}/versions">client.projects.commits.<a href="./src/resources/projects/commits.ts">list</a>(projectId, { ...params }) -> CommitListResponse</code>

## InferencePipelines

Types:

- <code><a href="./src/resources/projects/inference-pipelines.ts">InferencePipelineCreateResponse</a></code>
- <code><a href="./src/resources/projects/inference-pipelines.ts">InferencePipelineListResponse</a></code>

Methods:

- <code title="post /projects/{projectId}/inference-pipelines">client.projects.inferencePipelines.<a href="./src/resources/projects/inference-pipelines.ts">create</a>(projectId, { ...params }) -> InferencePipelineCreateResponse</code>
- <code title="get /projects/{projectId}/inference-pipelines">client.projects.inferencePipelines.<a href="./src/resources/projects/inference-pipelines.ts">list</a>(projectId, { ...params }) -> InferencePipelineListResponse</code>

# Commits

## TestResults

Types:

- <code><a href="./src/resources/commits/test-results.ts">TestResultListResponse</a></code>

Methods:

- <code title="get /versions/{projectVersionId}/results">client.commits.testResults.<a href="./src/resources/commits/test-results.ts">list</a>(projectVersionId, { ...params }) -> TestResultListResponse</code>

# InferencePipelines

## Data

Types:

- <code><a href="./src/resources/inference-pipelines/data.ts">DataStreamResponse</a></code>

Methods:

- <code title="post /inference-pipelines/{inferencePipelineId}/data-stream">client.inferencePipelines.data.<a href="./src/resources/inference-pipelines/data.ts">stream</a>(inferencePipelineId, { ...params }) -> DataStreamResponse</code>

## Rows

Types:

- <code><a href="./src/resources/inference-pipelines/rows.ts">RowUpdateResponse</a></code>

Methods:

- <code title="put /inference-pipelines/{inferencePipelineId}/rows">client.inferencePipelines.rows.<a href="./src/resources/inference-pipelines/rows.ts">update</a>(inferencePipelineId, { ...params }) -> RowUpdateResponse</code>

## TestResults

Types:

- <code><a href="./src/resources/inference-pipelines/test-results.ts">TestResultListResponse</a></code>

Methods:

- <code title="get /inference-pipelines/{inferencePipelineId}/results">client.inferencePipelines.testResults.<a href="./src/resources/inference-pipelines/test-results.ts">list</a>(inferencePipelineId, { ...params }) -> TestResultListResponse</code>

# Storage

## PresignedURL

Types:

- <code><a href="./src/resources/storage/presigned-url.ts">PresignedURLCreateResponse</a></code>

Methods:

- <code title="post /storage/presigned-url">client.storage.presignedURL.<a href="./src/resources/storage/presigned-url.ts">create</a>({ ...params }) -> PresignedURLCreateResponse</code>
