/*-
 *
 * Hedera JSON RPC Relay
 *
 * Copyright (C) 2022-2024 Hedera Hashgraph, LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *      http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 *
 */

import { Octokit } from '@octokit/core';
import { GitHubContext } from '../types/GitHubContext';

/**
 * Client for interacting with GitHub, providing methods to perform operations such as adding comments to pull requests.
 */
export class GitHubClient {
  private static readonly GET_COMMENTS_ENDPOINT = 'GET /repos/{owner}/{repo}/issues/{issue_number}/comments';
  private static readonly CREATE_COMMENT_ENDPOINT = 'POST /repos/{owner}/{repo}/issues/{issue_number}/comments';
  private static readonly UPDATE_COMMENT_ENDPOINT = 'PATCH /repos/{owner}/{repo}/issues/comments/{comment_id}';

  /**
   * The Octokit instance used to interact with GitHub.
   * @private
   */
  private readonly octokit: Octokit;

  constructor(octokit?: Octokit) {
    this.octokit = octokit || new Octokit({ auth: process.env.GITHUB_TOKEN });
  }

  /**
   * Update or add a comment to a pull request.
   * @param {string} commentBody - The body of the comment.
   * @returns {Promise<void>} A promise that resolves when the comment is successfully updated or added.
   */
  async updateOrAddCommentToPullRequest(commentBody: string): Promise<void> {
    const comments = await this.getCommentsOnPullRequest();
    // TODO: Used for debugging, remove this later
    console.log(comments);
    const existingComment = comments.data.find((comment) => comment.user?.login === 'github-actions[bot]');
    if (existingComment) {
      await this.updateCommentOnPullRequest(commentBody, existingComment.id);
    } else {
      await this.addCommentToPullRequest(commentBody);
    }
  }

  /**
   * Gets a list of comments on a pull request.
   * @returns A promise that resolves with the list of comments.
   */
  async getCommentsOnPullRequest() {
    try {
      const context = GitHubClient.getContext();
      const response = await this.octokit.request(GitHubClient.GET_COMMENTS_ENDPOINT, {
        owner: context.owner,
        repo: context.repo,
        issue_number: context.pullNumber,
      });
      console.info('Comments retrieved successfully:', response);
      return response;
    } catch (error) {
      console.error('Failed to retrieve comments on PR:', error);
      return { data: [] };
    }
  }

  /**
   * Updates a comment on a pull request.
   * @param {string} commentBody - The body of the comment.
   * @param {number} commentId - The ID of the comment to update.
   * @returns {Promise<void>} A promise that resolves when the comment is successfully updated.
   */
  async updateCommentOnPullRequest(commentBody: string, commentId: number): Promise<void> {
    try {
      const context = GitHubClient.getContext();
      const response = await this.octokit.request(GitHubClient.UPDATE_COMMENT_ENDPOINT, {
        owner: context.owner,
        repo: context.repo,
        comment_id: commentId,
        body: commentBody,
      });
      console.info('Comment updated successfully:', response);
    } catch (error) {
      console.error('Failed to update comment on PR:', error);
    }
  }

  /**
   * Adds a comment to a pull request.
   * @param {string} commentBody - The body of the comment.
   * @returns {Promise<void>} A promise that resolves when the comment is successfully posted.
   */
  async addCommentToPullRequest(commentBody: string): Promise<void> {
    try {
      const context = GitHubClient.getContext();
      const response = await this.octokit.request(GitHubClient.CREATE_COMMENT_ENDPOINT, {
        owner: context.owner,
        repo: context.repo,
        issue_number: context.pullNumber,
        body: commentBody,
      });
      console.info('Comment posted successfully:', response);
    } catch (error) {
      console.error('Failed to post comment to PR:', error);
    }
  }

  /**
   * Retrieves the GitHub context from environment variables.
   * @returns {GitHubContext} The GitHub context.
   */
  private static getContext(): GitHubContext {
    const { GITHUB_REPOSITORY, GITHUB_PR_NUMBER, GITHUB_COMMIT_SHA, GITHUB_TOKEN } = process.env;
    if (!GITHUB_REPOSITORY || !GITHUB_PR_NUMBER || !GITHUB_COMMIT_SHA || !GITHUB_TOKEN) {
      throw new Error(
        `Missing required environment variables: 
        $GITHUB_REPOSITORY, $GITHUB_PR_NUMBER, $GITHUB_COMMIT_SHA, $GITHUB_TOKEN`,
      );
    }

    const pullNumber = parseInt(GITHUB_PR_NUMBER);
    if (isNaN(pullNumber)) {
      throw new Error('Invalid PR number: $GITHUB_PR_NUMBER must be a valid number.');
    }

    const [owner, repo] = GITHUB_REPOSITORY.split('/');
    if (!owner || !repo) {
      throw new Error('Invalid $GITHUB_REPOSITORY format: Expected "owner/repo".');
    }

    return { owner, repo, pullNumber, token: GITHUB_TOKEN, commitId: GITHUB_COMMIT_SHA };
  }
}
