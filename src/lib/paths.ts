import path from 'path';
import os from 'os';

// Get home directory dynamically
const HOME = process.env.HOME || os.homedir();
const OPENCLAW_DIR = path.join(HOME, '.openclaw');
const WORKSPACE_DIR = path.join(HOME, '.openclaw');

// Mission Control paths
export const MC_DATA_DIR = path.join(process.cwd(), 'data');
export const MC_DB_PATH = path.join(MC_DATA_DIR, 'mission-control.db');
export const MC_AGENT_CONFIGS = path.join(MC_DATA_DIR, 'agent-configs.json');

// OpenClaw paths
export const OPENCLAW_CONFIG = path.join(OPENCLAW_DIR, 'openclaw.json');
export const AGENTS_DIR = path.join(OPENCLAW_DIR, 'agents');
export const WORKSPACE = path.join(WORKSPACE_DIR, 'workspace');
export const WORKSPACE_PREFIX = path.join(WORKSPACE_DIR, 'workspace-');
export const PLUGIN_APPROVALS = path.join(OPENCLAW_DIR, 'plugin-approvals.json');
export const EXEC_APPROVALS = path.join(OPENCLAW_DIR, 'exec-approvals.json');
export const TEMPLATE_WORKSPACE = WORKSPACE; // For creating new agent workspaces

// Helper to get workspace for an agent
export function getAgentWorkspace(agentId: string): string {
  return agentId === 'main' ? WORKSPACE : `${WORKSPACE_PREFIX}${agentId}`;
}

// Helper to get session directory for an agent
export function getAgentSessionsDir(agentId: string): string {
  return path.join(AGENTS_DIR, agentId, 'sessions');
}

// Helper to get agent directory
export function getAgentDir(agentId: string): string {
  return path.join(AGENTS_DIR, agentId);
}