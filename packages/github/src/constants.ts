export const GITHUB_EVENTS = {
  PULL_REQUEST: "pull_request",
  INSTALLATION: "installation",
  INSTALLATION_REPOSITORIES: "installation_repositories",
  PULL_REQUEST_REVIEW: "pull_request_review",
  PULL_REQUEST_REVIEW_COMMENT: "pull_request_review_comment",
} as const;

export const GITHUB_HEADERS = {
  EVENT: "x-github-event",
  DELIVERY: "x-github-delivery",
  SIGNATURE: "x-hub-signature-256",
} as const;
