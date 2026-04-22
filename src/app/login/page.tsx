'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { Eye, EyeOff, Sparkles, RefreshCw } from 'lucide-react'
import { AnimatedCharacters } from '@/components/ui/animated-characters'

export default function LoginPage() {
  const router = useRouter()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [isTyping, setIsTyping] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState('')
  const [captchaId, setCaptchaId] = useState('')
  const [captchaQuestion, setCaptchaQuestion] = useState('')
  const [captchaInput, setCaptchaInput] = useState('')
  const [loginAttempts, setLoginAttempts] = useState(0)
  const [projectName, setProjectName] = useState('OpenClaw Panel')
  
  const fetchCaptcha = async () => {
    try {
      const res = await fetch('/api/auth/captcha')
      const data = await res.json()
      if (data.id && data.question) {
        setCaptchaId(data.id)
        setCaptchaQuestion(data.question)
        setCaptchaInput('')
      }
    } catch (err) {
      console.error('Failed to fetch captcha:', err)
    }
  }

  const fetchSettings = async () => {
    try {
      const res = await fetch('/api/settings')
      const data = await res.json()
      if (data.projectName) {
        setProjectName(data.projectName)
      }
    } catch (err) {
      console.error('Failed to fetch settings:', err)
    }
  }

  useEffect(() => {
    fetchCaptcha()
    fetchSettings()
  }, [])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    
    // Prevent double submission
    if (isLoading) return
    
    setError('')
    
    if (!captchaId || !captchaInput) {
      setError('请输入验证码')
      return
    }
    
    // Verify CAPTCHA first
    try {
      const captchaRes = await fetch('/api/auth/captcha', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: captchaId, answer: captchaInput }),
      })
      const captchaData = await captchaRes.json()
      
      if (!captchaData.valid) {
        setError(captchaData.error || '验证码错误')
        fetchCaptcha()
        return
      }
    } catch {
      setError('验证码验证失败')
      return
    }
    
    if (loginAttempts >= 5) {
      setError('登录尝试次数过多，请稍后再试')
      return
    }
    
    setIsLoading(true)

    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: email, password }),
      })

      const data = await res.json()

      if (!res.ok) {
        setError(data.error || '登录失败')
        setLoginAttempts(prev => prev + 1)
        // Get new captcha on failure
        setCaptchaId('')
        setCaptchaQuestion('')
        fetchCaptcha()
        setIsLoading(false)
        return
      }

      setLoginAttempts(0)
      
      // Set cookies without secure flag for local development
      document.cookie = `mc-auth=true; path=/; max-age=${7 * 24 * 60 * 60}`
      document.cookie = `mc-user=${encodeURIComponent(JSON.stringify(data.user))}; path=/; max-age=${7 * 24 * 60 * 60}`
      
      // Store project name in cookie for use on main page
      if (data.projectName) {
        document.cookie = `mc-project-name=${encodeURIComponent(data.projectName)}; path=/; max-age=${7 * 24 * 60 * 60}`
      }
      
      // Small delay to ensure cookie is set before redirect
      setTimeout(() => {
        router.push('/')
      }, 100)
    } catch (err) {
      setError('网络错误，请重试')
      setIsLoading(false)
    }
  }

  return (
    <div className="min-h-screen max-h-screen overflow-hidden grid lg:grid-cols-2">
      {/* Left Content Section with Animated Characters */}
      <div className="relative hidden lg:flex flex-col justify-between bg-gradient-to-br from-gray-400 via-gray-500 to-gray-600 dark:from-white/90 dark:via-white/80 dark:to-white/70 p-12 text-white dark:text-gray-900">
        <div className="relative z-20">
          <Link href="/" className="flex items-center gap-2 text-lg font-semibold">
            <div className="w-9 h-9 rounded-lg bg-gradient-to-br from-orange-500 to-red-500 flex items-center justify-center text-lg">
              🦞
            </div>
            <span>{projectName}</span>
          </Link>
        </div>

        <div className="relative z-20 flex items-end justify-center h-[500px]">
          <AnimatedCharacters
            isTyping={isTyping}
            showPassword={showPassword}
            passwordLength={password.length}
          />
        </div>

        <div className="relative z-20 flex items-center gap-8 text-sm text-gray-600 dark:text-gray-700">
          <span>© 2026 {projectName}</span>
        </div>

        {/* Decorative elements */}
        <div className="absolute inset-0 bg-grid-white/[0.05] bg-[size:20px_20px]" />
        <div className="absolute top-1/4 right-1/4 size-64 bg-gray-400/20 dark:bg-gray-300/30 rounded-full blur-3xl" />
        <div className="absolute bottom-1/4 left-1/4 size-96 bg-gray-300/20 dark:bg-gray-200/20 rounded-full blur-3xl" />
      </div>

      {/* Right Login Section */}
      <div className="flex items-center justify-center p-8 bg-gray-950">
        <div className="w-full max-w-[420px]">
          {/* Mobile Logo */}
          <div className="lg:hidden flex items-center justify-center gap-2 text-lg font-semibold mb-12">
            <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-orange-500 to-red-500 flex items-center justify-center text-xl text-white">
              🦞
            </div>
            <span className="text-white">{projectName}</span>
          </div>

          {/* Header */}
          <div className="text-center mb-10">
            <h1 className="text-3xl font-bold tracking-tight mb-2 text-white">
              欢迎回来
            </h1>
            <p className="text-gray-400 text-sm">
              请输入您的账号信息
            </p>
          </div>

          {/* Login Form */}
          <form onSubmit={handleSubmit} className="space-y-5">
            <div className="space-y-2">
              <label htmlFor="email" className="text-sm font-medium text-gray-300">
                账号
              </label>
              <input
                id="email"
                type="text"
                placeholder="请输入账号"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full h-12 px-4 bg-gray-900 border border-gray-700 rounded-xl text-white placeholder-gray-500 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-all"
              />
            </div>

            <div className="space-y-2">
              <label htmlFor="password" className="text-sm font-medium text-gray-300">
                密码
              </label>
              <div className="relative">
                <input
                  id="password"
                  type={showPassword ? 'text' : 'password'}
                  placeholder="请输入密码"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  onFocus={() => setIsTyping(true)}
                  onBlur={() => setIsTyping(false)}
                  className="w-full h-12 px-4 pr-12 bg-gray-900 border border-gray-700 rounded-xl text-white placeholder-gray-500 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-all"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-300 transition-colors"
                >
                  {showPassword ? <EyeOff className="size-5" /> : <Eye className="size-5" />}
                </button>
              </div>
            </div>

            {/* CAPTCHA */}
            <div className="space-y-2">
              <label className="text-sm font-medium text-gray-300">
                验证码
              </label>
              <div className="flex gap-3">
                <input
                  type="text"
                  placeholder="输入答案"
                  value={captchaInput}
                  onChange={(e) => setCaptchaInput(e.target.value.replace(/[^0-9]/g, ''))}
                  className="flex-1 h-12 px-4 bg-gray-900 border border-gray-700 rounded-xl text-white text-center text-lg font-mono focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
                  maxLength={4}
                />
                <button
                  type="button"
                  onClick={fetchCaptcha}
                  className="px-4 bg-gray-800 border border-gray-700 rounded-xl hover:bg-gray-700 transition-colors flex items-center justify-center"
                >
                  {captchaQuestion ? (
                    <span className="text-white text-lg font-mono">{captchaQuestion}</span>
                  ) : (
                    <RefreshCw className="w-5 h-5 text-gray-400 animate-spin" />
                  )}
                </button>
              </div>
              <p className="text-xs text-gray-500">请计算结果后输入</p>
            </div>

            {error && (
              <div className="p-3 text-sm text-red-400 bg-red-500/10 border border-red-500/30 rounded-lg">
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={isLoading || !email || !password || !captchaInput}
              className="w-full h-12 bg-gradient-to-r from-blue-500 to-purple-500 text-white font-medium rounded-xl hover:from-blue-600 hover:to-purple-600 disabled:opacity-50 disabled:cursor-not-allowed transition-all flex items-center justify-center gap-2"
            >
              {isLoading ? (
                <>
                  <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  验证中...
                </>
              ) : (
                <>
                  <Sparkles className="w-5 h-5" />
                  登录
                </>
              )}
            </button>
          </form>

          {/* Security note */}
          <p className="text-xs text-gray-600 text-center mt-6">
            本地部署，数据仅存储在您的设备
          </p>
        </div>
      </div>
    </div>
  )
}
