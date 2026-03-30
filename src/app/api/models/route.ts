import { NextResponse } from 'next/server'
import { readFileSync } from 'fs'
import type { NextRequest } from 'next/server'

const OPENCLAW_CONFIG = '/home/bullrom/.openclaw/openclaw.json'

export async function GET(request: NextRequest) {
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
    
    return NextResponse.json({ models: modelList })
  } catch (e) {
    console.error('Error reading models from openclaw.json:', e)
    return NextResponse.json({ error: 'Failed to load models' }, { status: 500 })
  }
}
