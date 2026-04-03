import { NextResponse } from 'next/server'
import { readFileSync } from 'fs'
import type { NextRequest } from 'next/server'

const OPENCLAW_CONFIG = '/home/bullrom/.openclaw/openclaw.json'

// In-memory cache
let modelsCache: { data: any; timestamp: number } = { data: null, timestamp: 0 }
const CACHE_TTL = 5000 // 5 seconds

export async function GET(request: NextRequest) {
  const now = Date.now()
  
  // Return cached data if still fresh
  if (modelsCache.data && modelsCache.timestamp && (now - modelsCache.timestamp) < CACHE_TTL) {
    return NextResponse.json(modelsCache.data)
  }
  
  try {
    const config = JSON.parse(readFileSync(OPENCLAW_CONFIG, 'utf-8'))
    const models = config.models || {}
    const providers = models.providers || {}
    
    const modelList: { value: string; label: string }[] = []
    
    // Add default model if set
    if (models.default) {
      modelList.push({
        value: models.default,
        label: `${models.default} (默认)`
      })
    }
    
    // Iterate through providers and add their models
    for (const [providerName, providerConfig] of Object.entries(providers)) {
      const config = providerConfig as any
      const modelsArray = config.models || []
      
      for (const model of modelsArray) {
        const id = model.id
        const name = model.name || id
        const input = model.input || []
        
        // Determine label suffix based on capabilities
        let suffix = ''
        if (input.includes('image')) {
          suffix = ' (多模态)'
        }
        
        modelList.push({
          value: `${providerName}/${id}`,
          label: `${name}${suffix}`
        })
      }
    }
    
    const result = { models: modelList }
    modelsCache = { data: result, timestamp: now }
    
    return NextResponse.json(result)
  } catch (e) {
    console.error('Error reading models from openclaw.json:', e)
    // Return cached data on error if available
    if (modelsCache.data) {
      return NextResponse.json(modelsCache.data)
    }
    return NextResponse.json({ error: 'Failed to load models' }, { status: 500 })
  }
}
