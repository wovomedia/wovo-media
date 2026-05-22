'use client'
import { useEffect, useState } from 'react'

export default function ThemeToggle() {
  const [dark, setDark] = useState(false)

  useEffect(() => {
    const saved = localStorage.getItem('wovo-theme')
    const isDark = saved === 'dark'
    setDark(isDark)
    document.documentElement.setAttribute('data-theme', isDark ? 'dark' : 'light')
  }, [])

  const toggle = () => {
    const next = !dark
    setDark(next)
    const theme = next ? 'dark' : 'light'
    localStorage.setItem('wovo-theme', theme)
    document.documentElement.setAttribute('data-theme', theme)
  }

  return (
    <button onClick={toggle} className="theme-toggle" title={dark ? 'Switch to light' : 'Switch to dark'} style={{display:'flex',alignItems:'center',position:'relative',width:44,height:24}}>
      <span style={{position:'absolute',left:dark?'unset':'4px',right:dark?'4px':'unset',fontSize:11,zIndex:1,userSelect:'none'}}>
        {dark ? '🌙' : '☀️'}
      </span>
      <span className="theme-toggle-knob" style={{transform:dark?'translateX(20px)':'translateX(0px)',background:'var(--accent)',width:18,height:18,borderRadius:'50%',position:'absolute',left:3,transition:'transform 0.2s'}}/>
    </button>
  )
}
