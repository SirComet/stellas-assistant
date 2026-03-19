# Stella's Assistant — User Stories

## Pages / Website Builder

- As Stella, I want to create new pages so I can build my website without touching code directly.
- As Stella, I want to search and filter my pages list so I can quickly find the page I need to edit.
- As Stella, I want to delete pages I no longer need, with a confirmation prompt so I don't accidentally remove content.
- As Stella, I want to edit a page's HTML and CSS directly in the editor so I have full control over the design.
- As Stella, I want to preview a page rendered in an iframe so I can see exactly how it will look before publishing.
- As Stella, I want to use the AI generate prompt to create a page from a text description so I can go from idea to layout in seconds.
- As Stella, I want to toggle a page between draft and published status so I can control which pages are live.
- As Stella, I want the page slug to auto-generate from the title so I don't have to type it manually.

## Content Management

### Blog Posts

- As Stella, I want to see a list of all my blog posts with their status, tags, and author so I can manage my content library at a glance.
- As Stella, I want to create a new blog post with a title, excerpt, full content, tags, and category so I can publish articles on my website.
- As Stella, I want the post slug to auto-generate from the title so my URLs are always clean and consistent.
- As Stella, I want to use AI to generate blog content from a description so I can write drafts much faster.
- As Stella, I want to publish or unpublish a post with one click so I can control when content goes live.
- As Stella, I want to add a featured image URL to a blog post so posts display with visuals in listings.
- As Stella, I want to filter posts by status (draft/published/archived) so I can focus on what needs attention.
- As Stella, I want to delete a post with a confirmation so I don't accidentally remove published content.

### Case Studies

- As Stella, I want to create a case study with structured sections (challenge, solution, results, testimonial) so I can showcase client work in a professional format.
- As Stella, I want to assign a client name to a case study so visitors can understand who the work was done for.
- As Stella, I want to publish case studies the same way as blog posts so the workflow is consistent.
- As Stella, I want to search and filter case studies so I can quickly find and update past project stories.

### Services

- As Stella, I want to list all my services with title, price, duration, and features so potential clients can see what I offer.
- As Stella, I want to create and edit services inline without navigating to a separate page so I can make quick updates.
- As Stella, I want to set a sort order for services so I can control the display sequence on my website.
- As Stella, I want to archive services I no longer offer without deleting them so I keep a historical record.

## CRM — Contacts

- As Stella, I want to view contacts in a Kanban board organized by status (Lead, Prospect, Client, Inactive) so I can visualize my pipeline at a glance.
- As Stella, I want to switch between Kanban and table views so I can choose the format that works best for my workflow.
- As Stella, I want to click a contact card to open a slide-out drawer with full details so I can review information without losing context.
- As Stella, I want to add, edit, and delete contacts from the drawer and form so all contact management is in one place.
- As Stella, I want to log activities (notes, emails, calls, meetings) against a contact so I have a timeline of interactions.
- As Stella, I want to delete individual activity entries so I can remove errors from the timeline.
- As Stella, I want to search contacts by name, email, or company so I can find specific people quickly.
- As Stella, I want to assign tags to contacts so I can organize and group them.

## CRM — Projects

- As Stella, I want to view projects in a Kanban board with columns for Planning, Active, Review, Completed, and Paused so I can manage project stages visually.
- As Stella, I want to click a project card to open a slide-out drawer with project details and milestones so I can review progress without leaving the board.
- As Stella, I want to add milestones to a project and check them off as done so I can track deliverables within a project.
- As Stella, I want to delete milestones I no longer need so the milestone list stays accurate.
- As Stella, I want to associate a project with a contact (client) so I know who each project belongs to.
- As Stella, I want to set a budget and due date on each project so I can track financials and deadlines.
- As Stella, I want to switch between Kanban and table views for projects so I can choose the best layout for my current task.
- As Stella, I want to create, edit, and delete projects from the kanban page so all project management is centralized.

## Deploy

- As Stella, I want to add SSH deploy targets with a name, host, username, and remote path so I can configure where my pages get deployed.
- As Stella, I want to test the SSH connection to a target so I know it's working before attempting a deploy.
- As Stella, I want to deploy pages to a target with one click so publishing my website is simple.
- As Stella, I want to run shell commands on a deploy target so I can manage my server directly from the dashboard.
- As Stella, I want to see a log of past deployments with status and output so I can debug issues.

## Git

- As Stella, I want to configure a Git repository so I can version-control my website files.
- As Stella, I want to commit and push changes from the dashboard so I don't need to use the terminal.
- As Stella, I want to view recent commit history so I can see what changes have been made.
- As Stella, I want to create a new GitHub repository from the dashboard so I can get started without leaving the app.

## DigitalOcean

- As Stella, I want to enter my DigitalOcean API token once in settings so the integration is available across all DO pages.
- As Stella, I want to see a list of my droplets with name, status, region, size, and IP address so I have an overview of my cloud infrastructure.
- As Stella, I want a clear setup prompt when no API token is configured so I know exactly what to do.

## Admin — Users

- As Stella, I want to see a list of all platform users with their role and active status so I know who has access.
- As Stella, I want to invite a new user with an email, name, password, and role so I can grant access to team members.
- As Stella, I want to change a user's role (admin/editor/viewer) directly from the list so I can adjust permissions quickly.
- As Stella, I want to toggle a user's active/inactive status so I can suspend access without deleting the account.
- As Stella, I want to delete a user (except myself) with a confirmation so I can remove accounts that are no longer needed.
- As Stella, I want the admin section to show a 403 error to non-admin users so sensitive management pages are protected.

## Admin — Activity Log

- As Stella, I want to see a paginated log of all platform events with timestamp, user, action, resource type, and name so I have full audit visibility.
- As Stella, I want to filter the activity log by resource type so I can focus on specific areas of the platform.
- As Stella, I want the activity log to auto-refresh every 30 seconds so I always see near-real-time activity.
- As Stella, I want to paginate through the log with prev/next controls so I can review historical events.

## Admin — Database

- As Stella, I want to see row counts for every table in the database so I have a quick overview of data volume.
- As Stella, I want to see the database file size so I can monitor storage usage.

## AI Assistant

- As Stella, I want to open an AI chat panel from anywhere in the app so I can get help without navigating away from my current work.
- As Stella, I want to ask the AI to generate a page from a description so I can create layouts quickly.
- As Stella, I want to ask the AI to generate blog content so I can draft posts faster.
- As Stella, I want to start a new AI conversation and return to past sessions so I can pick up where I left off.

## Settings / LLM

- As Stella, I want to connect multiple AI providers (Google Gemini, Ollama, OpenAI, Claude) so I can choose the best model for each task.
- As Stella, I want to set an active AI provider and model so the app uses my preferred AI across all features.
- As Stella, I want to connect via OAuth or API key depending on the provider so I have flexible auth options.
- As Stella, I want to update my site settings (name, URL, description) from the settings page so I can configure the platform metadata.
- As Stella, I want to save my DigitalOcean API token in settings so it's available for the cloud integration.
