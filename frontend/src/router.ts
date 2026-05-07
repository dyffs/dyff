import { createRouter, createWebHistory } from 'vue-router'

import PullRequest from '@/modules/pull_request/PullRequest.vue'
import Login from '@/modules/account/Login.vue'
import MyAccount from '@/modules/account/MyAccount.vue'
import RepoList from '@/modules/repo/RepoList.vue'
import CodeReview from '@/modules/code_review/CodeReview.vue'
import AgentManagement from '@/modules/agent_management/AgentManagement.vue'
import GithubSetup from '@/modules/github_setup/GithubSetup.vue'
import LlmSetup from '@/modules/llms/LlmSetup.vue'
import TeamSettings from '@/modules/team/TeamSettings.vue'

declare module 'vue-router' {
  interface RouteMeta {
    hideLayout?: boolean
    requiresAuth?: boolean
    requiresGithubSetup?: boolean
  }
}

const routes = [
  { path: '/agents', component: AgentManagement },
  { path: '/repositories', component: RepoList },
  { path: '/repositories/:owner/:repo/pulls', component: PullRequest },
  { path: '/repositories/:owner/:repo/pulls/:pr_number', component: CodeReview },
  { path: '/account', component: MyAccount, meta: { requiresGithubSetup: false } },
  { path: '/github-setup', component: GithubSetup, meta: { requiresGithubSetup: false } },
  { path: '/llms', component: LlmSetup },
  { path: '/team', component: TeamSettings },
  { path: '/login', component: Login, meta: { hideLayout: true, requiresAuth: false, requiresGithubSetup: false } },
  { path: '/auth/callback', component: Login, meta: { hideLayout: true, requiresAuth: false, requiresGithubSetup: false } },
  { path: '/', redirect: '/repositories' },
]

export const router = createRouter({
  history: createWebHistory(),
  routes,
})
