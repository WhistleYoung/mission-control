import { NextResponse } from 'next/server'
import { readFileSync, writeFileSync } from 'fs'
import { verifyAuth, createAuthResponse } from '@/lib/auth'
import { restartGateway } from '@/lib/gateway'
import type { NextRequest } from 'next/server'

const OPENCLAW_CONFIG = '/home/bullrom/.openclaw/openclaw.json'

// GET /api/models-config - Get all models from openclaw.json
export async function GET(request: NextRequest) {
  const auth = verifyAuth(request)
  const errorResponse = createAuthResponse(auth.authorized, '请先登录')
  if (errorResponse) return errorResponse

  try {
    const config = JSON.parse(readFileSync(OPENCLAW_CONFIG, 'utf-8'))
    const modelsConfig = config.models || { mode: 'merge', providers: {} }
    
    // Transform to flat array with provider info
    const models: any[] = []
    for (const [providerId, providerData] of Object.entries(modelsConfig.providers || {})) {
      const provider = providerData as any
      for (const model of (provider.models || [])) {
        models.push({
          ...model,
          providerId,
          providerName: providerId,
          baseUrl: provider.baseUrl,
          apiKey: provider.apiKey ? '***' + provider.apiKey.slice(-4) : '',
          apiType: provider.api || 'openai-completions',
        })
      }
    }
    
    return NextResponse.json({
      mode: modelsConfig.mode,
      models,
      providers: modelsConfig.providers,
    })
  } catch (error) {
    console.error('Failed to fetch models config:', error)
    return NextResponse.json({ error: '获取模型配置失败' }, { status: 500 })
  }
}

// PUT /api/models-config - Update models config
export async function PUT(request: NextRequest) {
  const auth = verifyAuth(request)
  const errorResponse = createAuthResponse(auth.authorized, '请先登录')
  if (errorResponse) return errorResponse

  try {
    const { mode, providers } = await request.json()
    const config = JSON.parse(readFileSync(OPENCLAW_CONFIG, 'utf-8'))
    
    // Update models config
    config.models = {
      mode: mode || 'merge',
      providers: providers || config.models?.providers || {},
    }
    
    writeFileSync(OPENCLAW_CONFIG, JSON.stringify(config, null, 2))
    
    // Restart gateway to apply changes
    restartGateway()
    
    return NextResponse.json({ success: true, message: '模型配置已更新，网关即将重启' })
  } catch (error) {
    console.error('Failed to update models config:', error)
    return NextResponse.json({ error: '更新模型配置失败' }, { status: 500 })
  }
}

// POST /api/models-config - Add a new model or add models to existing provider
export async function POST(request: NextRequest) {
  const auth = verifyAuth(request)
  const errorResponse = createAuthResponse(auth.authorized, '请先登录')
  if (errorResponse) return errorResponse

  try {
    const { providerId, provider, models } = await request.json()
    
    if (!providerId || !models || !Array.isArray(models) || models.length === 0) {
      return NextResponse.json({ error: '缺少必要参数' }, { status: 400 })
    }
    
    const config = JSON.parse(readFileSync(OPENCLAW_CONFIG, 'utf-8'))
    
    // Ensure providers object exists
    if (!config.models) {
      config.models = { mode: 'merge', providers: {} }
    }
    if (!config.models.providers) {
      config.models.providers = {}
    }
    
    // Check if provider exists
    const isNewProvider = !config.models.providers[providerId]
    
    // Add or update provider
    config.models.providers[providerId] = {
      baseUrl: provider.baseUrl,
      apiKey: provider.apiKey,
      api: provider.api || 'openai-completions',
      models: isNewProvider ? [] : config.models.providers[providerId].models,
    }
    
    // Add all models to provider
    for (const model of models) {
      // Check if model with same id already exists in this provider
      const existingModel = config.models.providers[providerId].models.find((m: any) => m.id === model.id)
      if (existingModel) {
        return NextResponse.json({ 
          error: `该厂家下已存在同 ID 的模型: ${model.id}（当前名称: ${existingModel.name}，新名称: ${model.name || model.id}）`,
          existingModelId: model.id,
          existingModelName: existingModel.name,
        }, { status: 409 })
      }

      const modelKey = `${providerId}/${model.id}`
      config.models.providers[providerId].models.push({
        id: model.id,
        name: model.name || model.id,
        reasoning: model.reasoning || false,
        input: model.input || ['text'],
        cost: model.cost || { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 },
        contextWindow: model.contextWindow || 128000,
        maxTokens: model.maxTokens || 8192,
      })
      
      // Also register model in agents.defaults.models so it can be selected for agents
      if (!config.agents) {
        config.agents = { defaults: { models: {} } }
      }
      if (!config.agents.defaults) {
        config.agents.defaults = { models: {} }
      }
      if (!config.agents.defaults.models) {
        config.agents.defaults.models = {}
      }
      config.agents.defaults.models[modelKey] = {}
    }
    
    writeFileSync(OPENCLAW_CONFIG, JSON.stringify(config, null, 2))
    
    // Restart gateway to apply changes
    restartGateway()
    
    return NextResponse.json({ 
      success: true, 
      message: `已添加 ${models.length} 个模型，网关即将重启` 
    })
  } catch (error) {
    console.error('Failed to add model:', error)
    return NextResponse.json({ error: '添加模型失败' }, { status: 500 })
  }
}

// PATCH /api/models-config - Update a model
export async function PATCH(request: NextRequest) {
  const auth = verifyAuth(request)
  const errorResponse = createAuthResponse(auth.authorized, '请先登录')
  if (errorResponse) return errorResponse

  try {
    const { searchParams } = new URL(request.url)
    const providerId = searchParams.get('providerId')
    const modelId = searchParams.get('modelId')
    const body = await request.json()
    
    if (!providerId || !modelId) {
      return NextResponse.json({ error: '缺少必要参数' }, { status: 400 })
    }
    
    const config = JSON.parse(readFileSync(OPENCLAW_CONFIG, 'utf-8'))
    
    if (!config.models?.providers?.[providerId]) {
      return NextResponse.json({ error: 'Provider not found' }, { status: 404 })
    }
    
    // Find and update model
    const models = config.models.providers[providerId].models
    const modelIndex = models.findIndex((m: any) => m.id === modelId)
    
    if (modelIndex === -1) {
      return NextResponse.json({ error: 'Model not found' }, { status: 404 })
    }
    
    // Update model fields
    models[modelIndex] = {
      ...models[modelIndex],
      ...body,
    }
    
    writeFileSync(OPENCLAW_CONFIG, JSON.stringify(config, null, 2))
    
    // Restart gateway to apply changes
    restartGateway()
    
    return NextResponse.json({ success: true, message: '模型已更新，网关即将重启' })
  } catch (error) {
    console.error('Failed to update model:', error)
    return NextResponse.json({ error: '更新模型失败' }, { status: 500 })
  }
}

// DELETE /api/models-config - Delete a model
export async function DELETE(request: NextRequest) {
  const auth = verifyAuth(request)
  const errorResponse = createAuthResponse(auth.authorized, '请先登录')
  if (errorResponse) return errorResponse

  try {
    const { searchParams } = new URL(request.url)
    const providerId = searchParams.get('providerId')
    const modelId = searchParams.get('modelId')
    
    if (!providerId || !modelId) {
      return NextResponse.json({ error: '缺少必要参数' }, { status: 400 })
    }
    
    const config = JSON.parse(readFileSync(OPENCLAW_CONFIG, 'utf-8'))
    
    if (!config.models?.providers?.[providerId]) {
      return NextResponse.json({ error: 'Provider not found' }, { status: 404 })
    }
    
    // Check if model is used by any agent
    const modelKey = `${providerId}/${modelId}`
    const boundAgents: string[] = []
    
    // Check defaults.model.primary
    if (config.agents?.defaults?.model?.primary === modelKey) {
      boundAgents.push('defaults (主默认模型)')
    }
    
    // Check individual agents in agents.list
    const agentsList = config.agents?.list || []
    for (const agent of agentsList) {
      if (agent.model === modelKey) {
        boundAgents.push(agent.name || agent.id)
      }
    }
    
    if (boundAgents.length > 0) {
      return NextResponse.json({ 
        error: '无法删除：模型被以下 agent 绑定',
        boundAgents: [...new Set(boundAgents)],
        modelKey 
      }, { status: 409 })
    }
    
    // Remove model from provider
    const models = config.models.providers[providerId].models
    config.models.providers[providerId].models = models.filter((m: any) => m.id !== modelId)
    
    // If no models left, remove provider
    if (config.models.providers[providerId].models.length === 0) {
      delete config.models.providers[providerId]
    }
    
    // Remove model from agents.defaults.models
    if (config.agents?.defaults?.models) {
      delete config.agents.defaults.models[modelKey]
    }
    
    writeFileSync(OPENCLAW_CONFIG, JSON.stringify(config, null, 2))
    
    // Restart gateway to apply changes
    restartGateway()
    
    return NextResponse.json({ success: true, message: '模型已删除，网关即将重启' })
  } catch (error) {
    console.error('Failed to delete model:', error)
    return NextResponse.json({ error: '删除模型失败' }, { status: 500 })
  }
}
