# Projects

Types:

- <code><a href="./src/resources/projects/projects.ts">ProjectCreateResponse</a></code>
- <code><a href="./src/resources/projects/projects.ts">ProjectListResponse</a></code>

Methods:

- <code title="post /projects">client.projects.<a href="./src/resources/projects/projects.ts">create</a>({ ...params }) -> ProjectCreateResponse</code>
- <code title="get /projects">client.projects.<a href="./src/resources/projects/projects.ts">list</a>({ ...params }) -> ProjectListResponse</code>

## Commits

Types:

- <code><a href="./src/resources/projects/commits.ts">CommitCreateResponse</a></code>
- <code><a href="./src/resources/projects/commits.ts">CommitListResponse</a></code>

Methods:

- <code title="post /projects/{projectId}/versions">client.projects.commits.<a href="./src/resources/projects/commits.ts">create</a>(projectID, { ...params }) -> CommitCreateResponse</code>
- <code title="get /projects/{projectId}/versions">client.projects.commits.<a href="./src/resources/projects/commits.ts">list</a>(projectID, { ...params }) -> CommitListResponse</code>

## InferencePipelines

Types:

- <code><a href="./src/resources/projects/inference-pipelines.ts">InferencePipelineCreateResponse</a></code>
- <code><a href="./src/resources/projects/inference-pipelines.ts">InferencePipelineListResponse</a></code>

Methods:

- <code title="post /projects/{projectId}/inference-pipelines">client.projects.inferencePipelines.<a href="./src/resources/projects/inference-pipelines.ts">create</a>(projectID, { ...params }) -> InferencePipelineCreateResponse</code>
- <code title="get /projects/{projectId}/inference-pipelines">client.projects.inferencePipelines.<a href="./src/resources/projects/inference-pipelines.ts">list</a>(projectID, { ...params }) -> InferencePipelineListResponse</code>

## Tests

Types:

- <code><a href="./src/resources/projects/tests.ts">TestCreateResponse</a></code>
- <code><a href="./src/resources/projects/tests.ts">TestUpdateResponse</a></code>
- <code><a href="./src/resources/projects/tests.ts">TestListResponse</a></code>

Methods:

- <code title="post /projects/{projectId}/tests">client.projects.tests.<a href="./src/resources/projects/tests.ts">create</a>(projectID, { ...params }) -> TestCreateResponse</code>
- <code title="put /projects/{projectId}/tests">client.projects.tests.<a href="./src/resources/projects/tests.ts">update</a>(projectID, { ...params }) -> TestUpdateResponse</code>
- <code title="get /projects/{projectId}/tests">client.projects.tests.<a href="./src/resources/projects/tests.ts">list</a>(projectID, { ...params }) -> TestListResponse</code>

# Workspaces

Types:

- <code><a href="./src/resources/workspaces/workspaces.ts">WorkspaceRetrieveResponse</a></code>
- <code><a href="./src/resources/workspaces/workspaces.ts">WorkspaceUpdateResponse</a></code>

Methods:

- <code title="get /workspaces/{workspaceId}">client.workspaces.<a href="./src/resources/workspaces/workspaces.ts">retrieve</a>(workspaceID) -> WorkspaceRetrieveResponse</code>
- <code title="put /workspaces/{workspaceId}">client.workspaces.<a href="./src/resources/workspaces/workspaces.ts">update</a>(workspaceID, { ...params }) -> WorkspaceUpdateResponse</code>

## Invites

Types:

- <code><a href="./src/resources/workspaces/invites.ts">InviteCreateResponse</a></code>
- <code><a href="./src/resources/workspaces/invites.ts">InviteListResponse</a></code>

Methods:

- <code title="post /workspaces/{workspaceId}/invites">client.workspaces.invites.<a href="./src/resources/workspaces/invites.ts">create</a>(workspaceID, { ...params }) -> InviteCreateResponse</code>
- <code title="get /workspaces/{workspaceId}/invites">client.workspaces.invites.<a href="./src/resources/workspaces/invites.ts">list</a>(workspaceID, { ...params }) -> InviteListResponse</code>

## APIKeys

Types:

- <code><a href="./src/resources/workspaces/api-keys.ts">APIKeyCreateResponse</a></code>

Methods:

- <code title="post /workspaces/{workspaceId}/api-keys">client.workspaces.apiKeys.<a href="./src/resources/workspaces/api-keys.ts">create</a>(workspaceID, { ...params }) -> APIKeyCreateResponse</code>

# Commits

Types:

- <code><a href="./src/resources/commits/commits.ts">CommitRetrieveResponse</a></code>

Methods:

- <code title="get /versions/{projectVersionId}">client.commits.<a href="./src/resources/commits/commits.ts">retrieve</a>(projectVersionID) -> CommitRetrieveResponse</code>

## TestResults

Types:

- <code><a href="./src/resources/commits/test-results.ts">TestResultListResponse</a></code>

Methods:

- <code title="get /versions/{projectVersionId}/results">client.commits.testResults.<a href="./src/resources/commits/test-results.ts">list</a>(projectVersionID, { ...params }) -> TestResultListResponse</code>

# InferencePipelines

Types:

- <code><a href="./src/resources/inference-pipelines/inference-pipelines.ts">InferencePipelineRetrieveResponse</a></code>
- <code><a href="./src/resources/inference-pipelines/inference-pipelines.ts">InferencePipelineUpdateResponse</a></code>

Methods:

- <code title="get /inference-pipelines/{inferencePipelineId}">client.inferencePipelines.<a href="./src/resources/inference-pipelines/inference-pipelines.ts">retrieve</a>(inferencePipelineID, { ...params }) -> InferencePipelineRetrieveResponse</code>
- <code title="put /inference-pipelines/{inferencePipelineId}">client.inferencePipelines.<a href="./src/resources/inference-pipelines/inference-pipelines.ts">update</a>(inferencePipelineID, { ...params }) -> InferencePipelineUpdateResponse</code>
- <code title="delete /inference-pipelines/{inferencePipelineId}">client.inferencePipelines.<a href="./src/resources/inference-pipelines/inference-pipelines.ts">delete</a>(inferencePipelineID) -> void</code>

## Data

Types:

- <code><a href="./src/resources/inference-pipelines/data.ts">DataStreamResponse</a></code>

Methods:

- <code title="post /inference-pipelines/{inferencePipelineId}/data-stream">client.inferencePipelines.data.<a href="./src/resources/inference-pipelines/data.ts">stream</a>(inferencePipelineID, { ...params }) -> DataStreamResponse</code>

## Rows

Types:

- <code><a href="./src/resources/inference-pipelines/rows.ts">RowUpdateResponse</a></code>

Methods:

- <code title="put /inference-pipelines/{inferencePipelineId}/rows">client.inferencePipelines.rows.<a href="./src/resources/inference-pipelines/rows.ts">update</a>(inferencePipelineID, { ...params }) -> RowUpdateResponse</code>

## TestResults

Types:

- <code><a href="./src/resources/inference-pipelines/test-results.ts">TestResultListResponse</a></code>

Methods:

- <code title="get /inference-pipelines/{inferencePipelineId}/results">client.inferencePipelines.testResults.<a href="./src/resources/inference-pipelines/test-results.ts">list</a>(inferencePipelineID, { ...params }) -> TestResultListResponse</code>

# Storage

## PresignedURL

Types:

- <code><a href="./src/resources/storage/presigned-url.ts">PresignedURLCreateResponse</a></code>

Methods:

- <code title="post /storage/presigned-url">client.storage.presignedURL.<a href="./src/resources/storage/presigned-url.ts">create</a>({ ...params }) -> PresignedURLCreateResponse</code>

# Tests

Types:

- <code><a href="./src/resources/tests.ts">TestEvaluateResponse</a></code>
- <code><a href="./src/resources/tests.ts">TestListResultsResponse</a></code>

Methods:

- <code title="post /tests/{testId}/evaluate">client.tests.<a href="./src/resources/tests.ts">evaluate</a>(testID, { ...params }) -> TestEvaluateResponse</code>
- <code title="get /tests/{testId}/results">client.tests.<a href="./src/resources/tests.ts">listResults</a>(testID, { ...params }) -> TestListResultsResponse</code>
