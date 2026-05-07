# TODO
- Cache token from github app in git.ts?
- The green accent color to notify changes in VSCode is pretty nice, I can replicate that on the full preview file
- I'm using vim to edit this todo which is quite nice, can I replicate this on the browser?

## PR activities
- PR status: approved vs merged, skipped
  - skipped is our internal status fastpr_status

- Reviewer comments and approval status
  - A PR can have multiple Reviews, each Review can have multiple Comments
    - List all comments from all reviews: /repos/{owner}/{repo}/pulls/{pull_number}/comments
    - A reply to a coomment: in_reply_to_id exist, pull_request_review_id is null
  - For comments that are now review on the PR: /repos/{owner}/{repo}/issues/{issue_number}/comments

  - The PR is approved when a review state is approved, list reviews: /repos/{owner}/{repo}/pulls/{pull_number}/reviews
  
Claude said to use GET /repos/{owner}/{repo}/issues/{issue_number}/timeline
This returns events including:
- review_requested - when a reviewer is (re)requested
- review_request_removed - when a request is removed
- reviewed - when a review is submitted
- committed - when the author pushes changes

## Comments
Comment Design
- Slack comments must be private to that team, if a user visits a public PR, Slack messages of different teams should not be shown

Comments stored in different tables for different sources, but link to the same user:
- github_comments table:
  - id: bigint
  - pull_request_id: bigint
  - user_id: bigint
  - content: jsonb
  - attachments: jsonb
  - code_anchor: jsonb
  - github_comment_id: bigint
  - github_thread_id: bigint (optional)

- slack_comments table:
  - id: bigint
  - pull_request_id: bigint
  - user_id: bigint
  - team_id: bigint
  - content: jsonb
  - attachments: jsonb
  - slack_comment_id: bigint
  - slack_thread_id: bigint (optional)

If a user Y in team A visits a public PR that has Github comments from user X in team B,
the comments and public info of X should be shown as normal.

However, if there are Slack comments from team B on the PR, the comments should be hidden
from user Y. That's why the team_id is not required for Github comments.

## User-Team structure
Each fastpr user can only be in one team. We auto create users from Github activity and assign them to the internal team.
What happens when an user registers and claims a username?
- Case 1: the user joins as a personal account, in this case, a new team will be created for that user.
  They follow our repo permission and the github comments from a PR is shown normally
- Case 2: the user joins from a team invitation, the team_id will be set to the team they joined.
  Permission rule now applies through the team, so they're able to see all comments from the PR

One important rule is that we never add the team_id to tables that are Github-sourced because these data can be access across teams.

## Github permission change
We haven't handled case the user is removed from Github organization but the repo is still tracked in our database.


# TODO
- Github permission
  - user is removed from org
  - when an org repo is tracked, it automatically becomes visible to all team members.
  However, that org repo may belong to a different org
  - untrack: must be an admin to untrack a team repo