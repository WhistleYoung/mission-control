'use client'

import { useState, useEffect } from 'react'

interface PixelWorkerProps {
  agentName: string
  agentEmoji: string
  status: 'idle' | 'working' | 'error'
  taskName?: string
}

interface AgentData {
  agentName: string
  agentEmoji: string
  status: 'idle' | 'working' | 'error'
  taskName?: string
  taskStartTime?: string | null
  subagentCount?: number
}

// 名字匹配函数 - 根据agent名称匹配火影角色
const matchCharacter = (agentName: string, index: number) => {
  const nameMap: Record<string, number> = {
    '卡卡西': 0, 'kakashi': 0,
    '鸣人': 1, 'naruto': 1,
    '四代': 2, 'minato': 2,
    '初代': 3, 'hashirama': 3,
    '二代': 4, 'tobirama': 4,
    '自来也': 5, 'jiraiya': 5,
    '雏田': 6, 'hinata': 6,
    '鼬': 7, 'itachi': 7,
    '佐助': 8, 'sasuke': 8,
    '迪达拉': 9, 'deidara': 9,
    '蝎': 10, 'sasori': 10,
    '角都': 11, 'kakuzu': 11,
    '飞段': 12, 'hidan': 12,
    '小南': 13, 'konan': 13,
    '佩恩': 14, 'pain': 14,
    '带土': 15, 'obito': 15,
  }
  
  const lowerName = agentName.toLowerCase()
  for (const [key, idx] of Object.entries(nameMap)) {
    if (lowerName.includes(key.toLowerCase())) {
      return idx
    }
  }
  return index % NARUTO_CHARACTERS.length
}

// 角色图片路径映射 - 正常状态
const CHARACTER_IMAGES: Record<number, string> = {
  0: '/naruto/kakashi.png',
  1: '/naruto/naruto.png',
  2: '/naruto/minato.png',
  3: '/naruto/hashirama.png',
  4: '/naruto/tobirama.png',
  5: '/naruto/jiraiya.png',
  6: '/naruto/hinata.png',
  7: '/naruto/itachi.png',
  8: '/naruto/sasuke.png',
  9: '/naruto/deidara.png',
  10: '/naruto/sasori.png',
  11: '/naruto/kakuzu.png',
  12: '/naruto/hidan.png',
  13: '/naruto/konan.png',
  14: '/naruto/pain.png',
  15: '/naruto/obito.png',
}

// 战斗状态图片映射
const CHARACTER_BATTLE_IMAGES: Record<number, string> = {
  0: '/naruto/kakashi-battle.png',
  1: '/naruto/naruto-battle.png',
  7: '/naruto/itachi-battle.png',
  8: '/naruto/sasuke-battle.png',
}
const NARUTO_CHARACTERS = [
  { name: '卡卡西', hair: '#E8E8E8', outfit: '#4A4A6A', headband: '#D4AF37', eye: '#222', hasSharingan: true },
  { name: '鸣人', hair: '#FFD700', outfit: '#FF6600', headband: '#FF0000', eye: '#4169E1', hasRasengan: true },
  { name: '四代', hair: '#FFD700', outfit: '#1E90FF', headband: '#FF6347', eye: '#4169E1', hasFlyingRasengan: true },
  { name: '初代', hair: '#2F4F4F', outfit: '#228B22', headband: '#228B22', eye: '#222', hasMokuton: true },
  { name: '二代', hair: '#1C1C1C', outfit: '#4B0082', headband: '#4B0082', eye: '#222', hasMinato: false },
  { name: '自来也', hair: '#FF4500', outfit: '#8B4513', headband: '#FF4500', eye: '#222', hasSage: true },
  { name: '雏田', hair: '#FFE4E1', outfit: '#FF69B4', headband: '#FF69B4', eye: '#87CEEB', hasByakugan: true },
  { name: '鼬', hair: '#1C1C1C', outfit: '#8B0000', headband: '#8B0000', eye: '#FF0000', hasSharingan: true },
  { name: '佐助', hair: '#1C1C1C', outfit: '#4B0082', headband: '#C0C0C0', eye: '#FF0000', hasSharingan: true, hasChidori: true },
  { name: '迪达拉', hair: '#FFD700', outfit: '#FF0000', headband: '#FF0000', eye: '#4169E1', isAkatsuki: true },
  { name: '蝎', hair: '#8B4513', outfit: '#8B0000', headband: '#8B0000', eye: '#222', isAkatsuki: true },
  { name: '角都', hair: '#1C1C1C', outfit: '#2F4F4F', headband: '#2F4F4F', eye: '#222', isAkatsuki: true },
  { name: '飞段', hair: '#1C1C1C', outfit: '#1C1C1C', headband: '#8B0000', eye: '#FF4500', isAkatsuki: true },
  { name: '小南', hair: '#FFE4E1', outfit: '#1C1C1C', headband: '#1C1C1C', eye: '#4169E1', isAkatsuki: true },
  { name: '佩恩', hair: '#E8E8E8', outfit: '#FF0000', headband: '#FF0000', eye: '#FF0000', isAkatsuki: true, isPain: true },
  { name: '带土', hair: '#1C1C1C', outfit: '#1C1C1C', headband: '#4B0082', eye: '#FF0000', hasSharingan: true },
]

// 像素忍者组件 - 精细版
const PixelNinja = ({ character, status }: { 
  character: typeof NARUTO_CHARACTERS[0]
  status: 'idle' | 'working' | 'error'
}) => {
  const [frame, setFrame] = useState(0)
  const [glowFrame, setGlowFrame] = useState(0)
  
  useEffect(() => {
    if (status === 'working') {
      const t = setInterval(() => {
        setFrame(f => (f + 1) % 8)
        setGlowFrame(g => (g + 1) % 2)
      }, 150)
      return () => clearInterval(t)
    } else {
      setFrame(0)
      setGlowFrame(0)
    }
  }, [status])

  const wkg = status === 'working'
  const err = status === 'error'
  
  // 攻击动画偏移
  const attackX = wkg ? [0, 2, 3, 2, 0, -2, -3, -2][frame] : 0
  const attackY = wkg ? [0, -1, 0, 1, 0, -1, 0, 1][frame] : 0
  
  // 颜色
  const skin = '#FFE4C4'
  const hair = character.hair
  const jacket = err ? '#660000' : character.outfit
  const headband = character.headband
  const eye = character.eye

  return (
    <div className="relative" style={{ width: 64, height: 80 }}>
      {/* 查克拉光环(战斗中) */}
      {wkg && (
        <div 
          className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 rounded-full animate-pulse"
          style={{ 
            width: 70, 
            height: 70, 
            background: `radial-gradient(circle, ${headband}30 0%, transparent 70%)`,
            animation: 'chakra-pulse 1s ease-in-out infinite',
          }}
        />
      )}
      
      {/* 写轮眼/白眼特效 */}
      {character.hasSharingan && wkg && (
        <div 
          className="absolute top-4 right-0 animate-spin"
          style={{ 
            width: 10, 
            height: 10, 
            border: '2px solid #ff0000',
            borderRadius: '50%',
            animationDuration: '0.4s',
            boxShadow: '0 0 6px #ff0000',
          }}
        />
      )}
      
      {/* 螺旋丸特效 */}
      {character.hasRasengan && wkg && (
        <div 
          className="absolute top-0 left-1/2 -translate-x-1/2 animate-ping"
          style={{ 
            width: 16, 
            height: 16, 
            background: 'radial-gradient(circle, #4169E1 0%, #87CEEB 50%, transparent 70%)',
            borderRadius: '50%',
            animationDuration: '0.6s',
            boxShadow: '0 0 12px #4169E1',
          }}
        />
      )}
      
      {/* 千鸟特效 */}
      {character.hasChidori && wkg && (
        <div 
          className="absolute top-3 right-0"
          style={{ 
            width: 12, 
            height: 12, 
            background: 'radial-gradient(circle, #00BFFF 0%, #E0FFFF 50%, transparent 70%)',
            borderRadius: '50%',
            boxShadow: '0 0 10px #00BFFF, 0 0 20px #00BFFF',
            animation: 'chidori-glow 0.3s infinite alternate',
          }}
        />
      )}

      {/* 身体容器 - 整体轻微浮动 */}
      <div 
        className="absolute"
        style={{ 
          left: '50%', 
          marginLeft: -24,
          bottom: 0,
          transform: `translate(${attackX}px, ${attackY}px)`,
          transition: 'transform 0.1s linear',
        }}
      >
        {/* 头发层 */}
        <div style={{ position: 'relative', width: 36, height: 24, marginLeft: 6 }}>
          {/* 头发主体 */}
          <div style={{ 
            position: 'absolute',
            width: 36, height: 18,
            background: hair,
            borderRadius: '10px 10px 0 0',
            top: 0,
          }} />
          {/* 左边刘海 */}
          <div style={{ 
            position: 'absolute',
            width: 6, height: 12,
            background: hair,
            borderRadius: '3px 0 4px 3px',
            top: 10, left: 0,
          }} />
          {/* 右边刘海 */}
          <div style={{ 
            position: 'absolute',
            width: 6, height: 12,
            background: hair,
            borderRadius: '0 3px 3px 4px',
            top: 10, right: 0,
          }} />
        </div>

        {/* 脸部 */}
        <div style={{ 
          position: 'relative',
          width: 32, height: 24,
          marginLeft: 8,
          background: skin,
          borderRadius: '4px 4px 6px 6px',
        }}>
          {/* 护额 */}
          <div style={{ 
            position: 'absolute',
            width: 34, height: 8,
            background: headband,
            top: -2, left: -1,
            borderRadius: 3,
            boxShadow: wkg ? `0 0 4px ${headband}` : 'none',
          }}>
            {/* 护额金属块 */}
            <div style={{ 
              position: 'absolute',
              width: 8, height: 5,
              background: '#C0C0C0',
              top: 1, left: 13,
              borderRadius: 1,
            }}>
              {/* 村里标志 */}
              <div style={{ 
                position: 'absolute',
                width: 4, height: 3,
                background: '#fff',
                top: 1, left: 2,
                borderRadius: 1,
              }} />
            </div>
          </div>
          
          {/* 左眼 */}
          <div style={{ 
            position: 'absolute',
            width: 8, height: 6,
            background: eye,
            borderRadius: '40% 40% 50% 50%',
            top: 8, left: 5,
            boxShadow: character.hasSharingan ? '0 0 3px #ff0000, inset 0 0 2px #ff0000' : 'none',
          }}>
            {/* 瞳孔 */}
            {character.hasSharingan && (
              <div style={{ 
                position: 'absolute',
                width: 3, height: 3,
                background: '#000',
                borderRadius: '50%',
                top: 1, left: 2,
              }} />
            )}
          </div>
          
          {/* 右眼 */}
          <div style={{ 
            position: 'absolute',
            width: 8, height: 6,
            background: eye,
            borderRadius: '40% 40% 50% 50%',
            top: 8, right: 5,
            boxShadow: character.hasSharingan ? '0 0 3px #ff0000, inset 0 0 2px #ff0000' : 'none',
          }}>
            {/* 瞳孔 */}
            {character.hasSharingan && (
              <div style={{ 
                position: 'absolute',
                width: 3, height: 3,
                background: '#000',
                borderRadius: '50%',
                top: 1, left: 2,
              }} />
            )}
          </div>
          
          {/* 眉毛 */}
          <div style={{ 
            position: 'absolute',
            width: 6, height: 2,
            background: hair,
            borderRadius: 1,
            top: 6, left: 5,
          }} />
          <div style={{ 
            position: 'absolute',
            width: 6, height: 2,
            background: hair,
            borderRadius: 1,
            top: 6, right: 5,
          }} />
          
          {/* 鼻子 */}
          <div style={{ 
            position: 'absolute',
            width: 2, height: 2,
            background: 'rgba(0,0,0,0.1)',
            borderRadius: '50%',
            top: 14, left: 15,
          }} />
          
          {/* 嘴巴 */}
          <div style={{ 
            position: 'absolute',
            width: wkg ? 6 : 4,
            height: wkg ? 2 : 1,
            background: wkg ? '#cc6666' : 'rgba(0,0,0,0.2)',
            borderRadius: wkg ? 1 : '50%',
            top: 17, left: 14,
          }} />
          
          {/* 腮红 */}
          <div style={{ 
            position: 'absolute',
            width: 4, height: 2,
            background: 'rgba(255,150,150,0.4)',
            borderRadius: '50%',
            top: 13, left: 2,
          }} />
          <div style={{ 
            position: 'absolute',
            width: 4, height: 2,
            background: 'rgba(255,150,150,0.4)',
            borderRadius: '50%',
            top: 13, right: 2,
          }} />
        </div>

        {/* 脖子 */}
        <div style={{ 
          width: 12, height: 4,
          marginLeft: 14,
          background: skin,
        }} />

        {/* 身体/衣服 */}
        <div style={{ 
          position: 'relative',
          width: 36, height: 28,
          marginLeft: 6,
          background: jacket,
          borderRadius: '4px 4px 0 0',
          boxShadow: wkg ? `0 0 6px ${headband}60` : 'none',
        }}>
          {/* 衣领 */}
          <div style={{ 
            position: 'absolute',
            width: 20, height: 6,
            background: skin,
            borderRadius: '0 0 6px 6px',
            top: 0, left: 8,
          }} />
          
          {/* 晓组织围巾 */}
          {character.isAkatsuki && (
            <div style={{ 
              position: 'absolute',
              width: 40, height: 6,
              background: 'linear-gradient(90deg, #1a1a1a, #8B0000)',
              top: 4, left: -2,
              borderRadius: 2,
            }} />
          )}
          
          {/* 衣服拉链/细节 */}
          <div style={{ 
            position: 'absolute',
            width: 2, height: 14,
            background: '#333',
            top: 10, left: 17,
          }} />
          
          {/* 口袋 */}
          <div style={{ 
            position: 'absolute',
            width: 8, height: 6,
            border: '1px solid rgba(0,0,0,0.2)',
            borderRadius: 2,
            bottom: 4, left: 6,
          }} />
          <div style={{ 
            position: 'absolute',
            width: 8, height: 6,
            border: '1px solid rgba(0,0,0,0.2)',
            borderRadius: 2,
            bottom: 4, right: 6,
          }} />
          
          {/* 战斗状态时的汗珠 */}
          {wkg && (
            <div style={{ 
              position: 'absolute',
              width: 3, height: 5,
              background: '#87CEEB',
              borderRadius: '50% 50% 50% 50%',
              top: 2, right: 4,
              animation: 'sweat-drop 0.8s infinite',
            }} />
          )}
        </div>

        {/* 手臂(战斗中) */}
        {wkg && (
          <>
            <div style={{ 
              position: 'absolute',
              width: 10, height: 6,
              background: skin,
              borderRadius: 3,
              top: 32, left: -4,
              transform: `translateX(${Math.sin(frame * Math.PI / 4) * 3}px)`,
            }} />
            <div style={{ 
              position: 'absolute',
              width: 10, height: 6,
              background: skin,
              borderRadius: 3,
              top: 32, right: -4,
              transform: `translateX(${Math.sin((frame + 4) * Math.PI / 4) * 3}px)`,
            }} />
          </>
        )}
      </div>
      
      {/* 错误状态红色闪烁 */}
      {err && (
        <div 
          className="absolute inset-0 animate-pulse"
          style={{ 
            background: 'rgba(255,0,0,0.2)',
            borderRadius: 8,
          }}
        />
      )}

      <style jsx>{`
        @keyframes chakra-pulse {
          0%, 100% { transform: translate(-50%, -50%) scale(1); opacity: 0.6; }
          50% { transform: translate(-50%, -50%) scale(1.1); opacity: 0.3; }
        }
        @keyframes chidori-glow {
          0% { box-shadow: 0 0 10px #00BFFF, 0 0 20px #00BFFF; }
          100% { box-shadow: 0 0 15px #00FFFF, 0 0 30px #00FFFF; }
        }
        @keyframes sweat-drop {
          0% { opacity: 1; transform: translateY(0); }
          100% { opacity: 0; transform: translateY(4px); }
        }
        @keyframes battle {
          0%, 100% { transform: scale(1.1) translateX(0); }
          25% { transform: scale(1.1) translateX(-2px) translateY(-1px); }
          50% { transform: scale(1.1) translateX(0) translateY(-2px); }
          75% { transform: scale(1.1) translateX(2px) translateY(-1px); }
        }
        @keyframes idle {
          0%, 100% { transform: scale(1) translateY(0); }
          50% { transform: scale(1) translateY(-2px); }
        }
        @keyframes error {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.5; }
        }
      `}</style>
    </div>
  )
}

// 3D办公室卡片
const OfficeCard3D = ({ agent, index }: { agent: AgentData; index: number }) => {
  const [hovered, setHovered] = useState(false)
  const [glow, setGlow] = useState(false)
  const [now, setNow] = useState(Date.now())
  const wkg = agent.status === 'working'
  const err = agent.status === 'error'
  
  // 获取角色配置
  // 获取角色配置 - 根据agent名称匹配
  const charIndex = matchCharacter(agent.agentName, index)
  const character = NARUTO_CHARACTERS[charIndex]

  useEffect(() => {
    if (wkg) {
      const t = setInterval(() => setGlow(g => !g), 800)
      return () => clearInterval(t)
    }
  }, [wkg])

  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 1000)
    return () => clearInterval(timer)
  }, [])

  // 主题颜色
  const themes = [
    { desk: '#1A1A2E', accent: '#FFD700', glow: 'rgba(255,215,0,0.4)', success: '#00FF88' },
    { desk: '#1A1A2E', accent: '#E74C3C', glow: 'rgba(231,76,60,0.4)', success: '#FF6B6B' },
    { desk: '#1A1A2E', accent: '#3498DB', glow: 'rgba(52,152,219,0.4)', success: '#00D4FF' },
    { desk: '#1A1A2E', accent: '#9B59B6', glow: 'rgba(155,89,182,0.4)', success: '#FF6B9D' },
  ]
  const theme = themes[index % themes.length]

  // 实际数据
  const runningTasks = wkg ? (agent.subagentCount || 0) : 0
  
  // 运行任务时长
  const getRunningDuration = () => {
    if (!wkg || !agent.taskStartTime) return '0m'
    const start = new Date(agent.taskStartTime).getTime()
    const diff = Math.floor((now - start) / 1000)
    if (diff < 60) return `${diff}s`
    if (diff < 3600) return `${Math.floor(diff / 60)}m`
    return `${Math.floor(diff / 3600)}h ${Math.floor((diff % 3600) / 60)}m`
  }
  const runningDuration = wkg ? getRunningDuration() : '0m'
  
  const messagesToday = wkg ? Math.floor(Math.random() * 50) + 20 : Math.floor(Math.random() * 5)
  const cpuLoad = wkg ? Math.floor(Math.random() * 40) + 60 : Math.floor(Math.random() * 10)

  return (
    <div
      className="relative"
      style={{
        width: 240,
        perspective: 800,
      }}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      {/* 3D卡片主体 */}
      <div
        className="relative transition-all duration-500"
        style={{
          transform: hovered 
            ? 'rotateY(-8deg) rotateX(5deg) translateZ(40px)' 
            : 'rotateY(-2deg) rotateX(2deg)',
          transformStyle: 'preserve-3d',
        }}
      >
        {/* 卡片背景 */}
        <div
          className="rounded-2xl overflow-hidden shadow-2xl"
          style={{
            background: `linear-gradient(145deg, ${theme.desk} 0%, #0d0d1a 100%)`,
            boxShadow: hovered 
              ? `0 30px 60px -15px ${theme.glow}, 0 0 40px ${theme.glow}`
              : `0 15px 40px rgba(0,0,0,0.4)`,
          }}
        >
          {/* 顶部装饰条 + 状态光效 */}
          <div className="relative">
            <div 
              className="h-1"
              style={{ background: `linear-gradient(90deg, ${theme.accent}, ${theme.glow})` }}
            />
            {wkg && (
              <div 
                className="absolute top-0 right-0 h-1 w-20 animate-pulse"
                style={{ background: theme.success, opacity: 0.7 }}
              />
            )}
          </div>

          {/* 主体内容 */}
          <div className="p-4">
            {/* 像素忍者头像 + 状态 */}
            <div className="flex items-center gap-3 mb-3">
              {/* 头像区域 - 真实图片 */}
              <div 
                className="relative flex items-center justify-center overflow-hidden"
                style={{ 
                  width: 72, 
                  height: 96,
                  background: `linear-gradient(135deg, ${theme.accent}20, ${theme.accent}10)`,
                  borderRadius: 12,
                  boxShadow: `0 6px 20px ${theme.glow}`,
                }}
              >
                {/* 角色真实图片 - 根据状态切换 + 动画 */}
                <img 
                  src={wkg && CHARACTER_BATTLE_IMAGES[charIndex] ? CHARACTER_BATTLE_IMAGES[charIndex] : CHARACTER_IMAGES[charIndex]}
                  alt={character.name}
                  className="w-full h-full object-cover object-top"
                  style={{ 
                    borderRadius: 12,
                    transform: wkg ? 'scale(1.1)' : 'scale(1)',
                    filter: err ? 'grayscale(60%) brightness(0.7)' : 'none',
                    animation: wkg 
                      ? 'battle 0.3s ease-in-out infinite' 
                      : err 
                      ? 'error 0.5s ease-in-out infinite' 
                      : 'idle 2s ease-in-out infinite',
                  }}
                />
                
                {/* 状态指示器 */}
                <div 
                  className="absolute -bottom-1 -right-1 w-6 h-6 rounded-full flex items-center justify-center text-sm border-2"
                  style={{ 
                    backgroundColor: wkg ? theme.success : err ? '#E74C3C' : '#555',
                    borderColor: '#0d0d1a',
                    boxShadow: wkg ? `0 0 10px ${theme.success}` : err ? `0 0 10px #E74C3C` : 'none',
                  }}
                >
                  {wkg ? '⚡' : err ? '!' : '💤'}
                </div>

                {/* 运行中光环 */}
                {wkg && (
                  <div 
                    className="absolute -inset-1 rounded-xl animate-ping"
                    style={{ 
                      backgroundColor: theme.accent,
                      opacity: 0.3,
                      animationDuration: '1.5s',
                    }}
                  />
                )}
              </div>

              <div className="flex-1 min-w-0">
                <h4 className="text-base font-bold text-white truncate mb-0.5">{character.name}</h4>
                <span className="text-xs text-gray-400 truncate">{agent.agentName}</span>
                <span 
                  className="inline-block text-xs px-2 py-0.5 rounded-full font-medium"
                  style={{ 
                    backgroundColor: wkg ? `${theme.success}30` : err ? '#E74C3C30' : '#55555530',
                    color: wkg ? theme.success : err ? '#E74C3C' : '#888',
                  }}
                >
                  {wkg ? '● 战斗中' : err ? '● 濒死' : '○ 休息'}
                </span>
              </div>
            </div>

            {/* 任务名称 */}
            {agent.taskName && wkg && (
              <div 
                className="text-xs px-3 py-2 rounded-lg mb-3 truncate flex items-center gap-2"
                style={{ backgroundColor: 'rgba(255,255,255,0.05)', color: '#ccc', borderLeft: `3px solid ${theme.accent}` }}
              >
                <span className="text-base">📋</span>
                <span className="truncate">{agent.taskName}</span>
              </div>
            )}

            {/* 状态指标网格 */}
            <div className="grid grid-cols-2 gap-2 mb-3">
              {/* Subagent数量 */}
              <div 
                className="rounded-lg p-2 text-center"
                style={{ backgroundColor: 'rgba(0,0,0,0.3)' }}
              >
                <div className="text-2xl mb-0.5">{wkg ? '🔧' : '📭'}</div>
                <div className="text-[10px] text-gray-400">部下</div>
                <div className="text-sm font-bold" style={{ color: theme.accent }}>
                  {runningTasks}
                </div>
              </div>

              {/* 今日消息 */}
              <div 
                className="rounded-lg p-2 text-center"
                style={{ backgroundColor: 'rgba(0,0,0,0.3)' }}
              >
                <div className="text-2xl mb-0.5">💬</div>
                <div className="text-[10px] text-gray-400">消息</div>
                <div className="text-sm font-bold" style={{ color: theme.accent }}>
                  {messagesToday}
                </div>
              </div>

              {/* 运行时长 */}
              <div 
                className="rounded-lg p-2 text-center"
                style={{ backgroundColor: 'rgba(0,0,0,0.3)' }}
              >
                <div className="text-2xl mb-0.5">⏱️</div>
                <div className="text-[10px] text-gray-400">战斗时长</div>
                <div className="text-sm font-bold" style={{ color: theme.accent }}>
                  {runningDuration}
                </div>
              </div>

              {/* CPU负载 */}
              <div 
                className="rounded-lg p-2 text-center"
                style={{ backgroundColor: 'rgba(0,0,0,0.3)' }}
              >
                <div className="text-2xl mb-0.5">📊</div>
                <div className="text-[10px] text-gray-400">查克拉</div>
                <div className="text-sm font-bold" style={{ color: cpuLoad > 80 ? '#E74C3C' : theme.accent }}>
                  {cpuLoad}%
                </div>
              </div>
            </div>

            {/* 负载进度条 */}
            <div className="mb-2">
              <div className="flex justify-between text-[10px] text-gray-400 mb-1">
                <span>查克拉消耗</span>
                <span style={{ color: cpuLoad > 80 ? '#E74C3C' : theme.accent }}>{cpuLoad}%</span>
              </div>
              <div 
                className="h-2 rounded-full overflow-hidden"
                style={{ backgroundColor: 'rgba(255,255,255,0.1)' }}
              >
                <div 
                  className="h-full rounded-full transition-all duration-500"
                  style={{ 
                    width: wkg ? `${cpuLoad}%` : '10%',
                    background: cpuLoad > 80 
                      ? 'linear-gradient(90deg, #E74C3C, #C0392B)' 
                      : `linear-gradient(90deg, ${theme.accent}, ${theme.success})`,
                  }}
                />
              </div>
            </div>

            {/* 心情 + 动作可视化 */}
            <div 
              className="flex items-center justify-between rounded-xl p-3"
              style={{ backgroundColor: 'rgba(0,0,0,0.2)' }}
            >
              <div className="text-center">
                <div className="text-2xl mb-1">
                  {wkg ? '😤' : err ? '😵' : '😴'}
                </div>
                <div className="text-[9px] text-gray-500">
                  {wkg ? '斗志' : err ? '虚弱' : '沉睡'}
                </div>
              </div>
              
              <div className="text-3xl">
                {wkg ? '🌀' : err ? '💀' : '🌙'}
              </div>

              <div className="text-center">
                <div className="flex gap-0.5 justify-center mb-1">
                  {[...Array(5)].map((_, i) => (
                    <div 
                      key={i}
                      className="w-1.5 rounded-full"
                      style={{ 
                        height: wkg ? (6 + i * 3 + Math.sin(i + now / 200) * 3) : 4,
                        backgroundColor: wkg ? (i < 3 ? theme.accent : '#555') : err ? '#E74C3C' : '#555',
                      }}
                    />
                  ))}
                </div>
                <div className="text-[9px] text-gray-500">战力</div>
              </div>
            </div>
          </div>

          {/* 底部状态条 */}
          <div 
            className="h-10 flex items-center px-4 gap-3"
            style={{ backgroundColor: 'rgba(0,0,0,0.4)', borderTop: '1px solid rgba(255,255,255,0.05)' }}
          >
            {/* 技能信息 */}
            <div className="flex items-center gap-1 text-xs text-gray-400">
              <span>
                {character.hasSharingan ? '📛' : 
                 character.hasRasengan ? '🌀' : 
                 character.hasByakugan ? '👁️' : 
                 character.isAkatsuki ? '☣️' : '⚔️'}
              </span>
              <span className="truncate max-w-[80px]">
                {character.hasSharingan ? '写轮眼' : 
                 character.hasRasengan ? '螺旋丸' : 
                 character.hasByakugan ? '白眼' : 
                 character.isAkatsuki ? '晓' : 
                 character.hasMokuton ? '木遁' : '普通'}
              </span>
            </div>

            <div className="flex-1">
              <div 
                className="h-1.5 rounded-full overflow-hidden"
                style={{ backgroundColor: 'rgba(255,255,255,0.1)' }}
              >
                <div 
                  className="h-full rounded-full transition-all"
                  style={{ 
                    width: wkg ? (glow ? '80%' : '65%') : err ? '95%' : '5%',
                    background: wkg 
                      ? `linear-gradient(90deg, ${theme.accent}, ${theme.success})` 
                      : err 
                      ? 'linear-gradient(90deg, #E74C3C, #C0392B)' 
                      : '#555',
                  }}
                />
              </div>
            </div>

            <div className="text-xs font-medium" style={{ color: theme.accent }}>
              {wkg ? `${60 + Math.floor(Math.random() * 35)}%` : err ? '!' : '0%'}
            </div>
          </div>
        </div>

        {/* 背面 */}
        <div
          className="absolute inset-0 rounded-2xl"
          style={{ 
            backgroundColor: theme.desk,
            transform: 'translateZ(-30px) rotateY(180deg)',
          }}
        />
      </div>

      <style jsx>{`
        @keyframes chidori {
          0%, 100% { transform: scale(1); opacity: 1; }
          50% { transform: scale(1.2); opacity: 0.8; }
        }
      `}</style>
    </div>
  )
}

export function WorkStatusScene({ agents }: { agents: AgentData[] }) {
  return (
    <div className="w-full overflow-auto pb-4">
      {/* 头部 */}
      <div className="text-center mb-8 px-4">
        <h3 
          className="text-2xl font-bold mb-2"
          style={{ 
            background: 'linear-gradient(135deg, #fff 0%, #aaa 100%)',
            WebkitBackgroundClip: 'text',
            WebkitTextFillColor: 'transparent',
          }}
        >
          🏯 忍者村战斗状态监控
        </h3>
        <p className="text-gray-400 text-sm">
          忍者 × {agents.length} · 
          <span className="text-green-400"> {agents.filter(a => a.status === 'working').length} 战斗中</span> · 
          <span className="text-red-400"> {agents.filter(a => a.status === 'error').length} 濒死</span> · 
          <span className="text-gray-500"> {agents.filter(a => a.status === 'idle').length} 休息</span>
        </p>
      </div>

      {/* 3D卡片网格 */}
      <div 
        className="flex flex-wrap justify-center gap-6 px-4"
        style={{ perspective: 1200 }}
      >
        {agents.map((agent, idx) => (
          <div 
            key={agent.agentName}
            style={{ animation: `fadeSlideIn 0.6s ease-out ${idx * 0.15}s both` }}
          >
            <OfficeCard3D agent={agent} index={idx} />
          </div>
        ))}
      </div>

      {/* 空状态 */}
      {agents.length === 0 && (
        <div className="text-center py-20">
          <div className="text-6xl mb-4">🏯</div>
          <h3 className="text-xl font-bold text-white mb-2">忍者村空无一人</h3>
          <p className="text-gray-400">等待新的忍者加入...</p>
        </div>
      )}

      {/* 底部装饰 */}
      <div className="flex justify-center gap-4 mt-8 text-2xl">
        <span className="animate-bounce" style={{ animationDuration: '2s' }}>🌸</span>
        <span className="animate-bounce" style={{ animationDuration: '2.5s' }}>🍃</span>
        <span className="animate-bounce" style={{ animationDuration: '3s' }}>⚔️</span>
        <span className="animate-bounce" style={{ animationDuration: '3.5s' }}>🌀</span>
      </div>

      <style jsx>{`
        @keyframes fadeSlideIn {
          from {
            opacity: 0;
            transform: translateY(40px) rotateX(-15deg);
          }
          to {
            opacity: 1;
            transform: translateY(0) rotateX(0);
          }
        }
        @keyframes battle {
          0%, 100% { transform: scale(1.1) translateX(0); }
          25% { transform: scale(1.1) translateX(-2px) translateY(-1px); }
          50% { transform: scale(1.1) translateX(0) translateY(-2px); }
          75% { transform: scale(1.1) translateX(2px) translateY(-1px); }
        }
        @keyframes idle {
          0%, 100% { transform: scale(1) translateY(0); }
          50% { transform: scale(1) translateY(-2px); }
        }
        @keyframes error {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.5; }
        }
        .animate-battle {
          animation: battle 0.3s ease-in-out infinite;
        }
        .animate-idle {
          animation: idle 2s ease-in-out infinite;
        }
        .animate-error {
          animation: error 0.5s ease-in-out infinite;
        }
      `}</style>
    </div>
  )
}

export function PixelWorker(props: PixelWorkerProps) {
  return null
}