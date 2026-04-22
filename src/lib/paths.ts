import path from 'path';
import os from 'os';
import { existsSync, readFileSync } from 'fs';

// Get home directory dynamically
const HOME = process.env.HOME || os.homedir();

// Default OpenClaw path (can be overridden by OPENCLAW_PATH env or database setting)
const DEFAULT_OPENCLAW_DIR = path.join(HOME, '.openclaw');

// Cached openclaw path from database (set at runtime via API)
let cachedOpenclawDir: string | null = null;

/**
 * Get OpenClaw base directory
 * Priority: OPENCLAW_PATH env > database setting > $HOME/.openclaw
 */
export function getOpenClawDir(): string {
  // Environment variable takes precedence
  if (process.env.OPENCLAW_PATH && existsSync(process.env.OPENCLAW_PATH)) {
    return process.env.OPENCLAW_PATH;
  }
  
  // If cached from database, use it
  if (cachedOpenclawDir && existsSync(cachedOpenclawDir)) {
    return cachedOpenclawDir;
  }
  
  // Default
  return DEFAULT_OPENCLAW_DIR;
}

/**
 * Set OpenClaw path (called from settings API)
 */
export function setOpenClawPath(openclawPath: string): void {
  if (openclawPath && existsSync(openclawPath)) {
    cachedOpenclawDir = openclawPath;
  }
}

/**
 * Check if OpenClaw is properly configured
 */
export function isOpenClawConfigured(): boolean {
  const dir = getOpenClawDir();
  const configPath = path.join(dir, 'openclaw.json');
  return existsSync(configPath);
}

// OpenClaw Panel paths
export const MC_DATA_DIR = path.join(process.cwd(), 'data');
export const MC_DB_PATH = path.join(MC_DATA_DIR, 'mission-control.db');
export const MC_AGENT_CONFIGS = path.join(MC_DATA_DIR, 'agent-configs.json');

// OpenClaw paths - use dynamic getOpenClawDir()
export function getOpenClawConfig(): string {
  return path.join(getOpenClawDir(), 'openclaw.json');
}

export function getAgentsDir(): string {
  return path.join(getOpenClawDir(), 'agents');
}

export function getWorkspace(): string {
  return path.join(getOpenClawDir(), 'workspace');
}

export function getWorkspacePrefix(): string {
  return path.join(getOpenClawDir(), 'workspace-');
}

export function getPluginApprovals(): string {
  return path.join(getOpenClawDir(), 'plugin-approvals.json');
}

export function getExecApprovals(): string {
  return path.join(getOpenClawDir(), 'exec-approvals.json');
}

// Backward compatibility - deprecated, use functions above
export const OPENCLAW_CONFIG = path.join(DEFAULT_OPENCLAW_DIR, 'openclaw.json');
export const AGENTS_DIR = path.join(DEFAULT_OPENCLAW_DIR, 'agents');
export const WORKSPACE = path.join(DEFAULT_OPENCLAW_DIR, 'workspace');
export const WORKSPACE_PREFIX = path.join(DEFAULT_OPENCLAW_DIR, 'workspace-');
export const PLUGIN_APPROVALS = path.join(DEFAULT_OPENCLAW_DIR, 'plugin-approvals.json');
export const EXEC_APPROVALS = path.join(DEFAULT_OPENCLAW_DIR, 'exec-approvals.json');
export const TEMPLATE_WORKSPACE = WORKSPACE;

// Helper to get workspace for an agent
export function getAgentWorkspace(agentId: string): string {
  const base = agentId === 'main' ? getWorkspace() : getWorkspacePrefix() + agentId;
  return base;
}

// Helper to get session directory for an agent
export function getAgentSessionsDir(agentId: string): string {
  return path.join(getAgentsDir(), agentId, 'sessions');
}

// Helper to get agent directory
export function getAgentDir(agentId: string): string {
  return path.join(getAgentsDir(), agentId);
}
