# Contributing to Hubspot MCP

## Overview

Contributions to this codebase are welcomed and appreciated. We encourage novice and professional developers alike to help improve the quality of our software, which is offered as a benefit to the open source community.

## Guidelines

### Issues

If you would like to raise any issues, please do so in the [Issues](https://github.com/shinzo-labs/hubspot-mcp/issues) section and a core contributor will respond in a timely manner. Issue threads may be closed if there are no additional comments added within 7 days of the last update on the thread.

### Code Contributions

If you would like to contribute code to the codebase, please contact austin@shinzolabs.com to discuss what feature you would like to add, or what features/bugs you may be able to own from the queue. The steps to then contribute would be:
1. Create a fork version of the repo.
2. Open a branch with a name prefixed with `feat/`, `fix/`, or `chore/`.
3. Implement the desired changes.
4. Run `npx @changesets/cli` to add a `changeset` for each distinct change in your feature. Read the [changeset README](.changeset/README.md) for more info.
5. Open a Pull Request from your forked repo back to the main repo. Tag one of the core contributors as a reviewer.
6. Once the core contributor has reviewed the code and all comments have been resolved, the PR will be approved and merged into the `main` branch.
7. Merged changes will be added to a versioned package release on a regular schedule.

## Contact

If you have any questions or comments about the guidelines here or anything else about the software, please contact austin@shinzolabs.com or open an issue.
