// Copyright 2026 Catsmum2025
// MIT License

import { useEffect, useRef } from 'react'

interface Particle {
  x: number
  y: number
  vx: number
  vy: number
  size: number
  color: string
  rotation: number
  rotationSpeed: number
  life: number
  maxLife: number
  shape: 'rect' | 'circle'
}

const COLORS = ['#F49D4D', '#74754F', '#30524E', '#FFFFFF', '#F49D4Dcc', '#74754Fcc']
const PARTICLE_COUNT = 120

export function Confetti({ active }: { active: boolean }): React.ReactElement {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const particlesRef = useRef<Particle[]>([])
  const animFrameRef = useRef<number>(0)

  useEffect(() => {
    if (!active) {
      particlesRef.current = []
      return
    }

    const canvas = canvasRef.current
    if (!canvas) return

    const ctx = canvas.getContext('2d')
    if (!ctx) return

    const resize = () => {
      canvas.width = window.innerWidth
      canvas.height = window.innerHeight
    }
    resize()
    window.addEventListener('resize', resize)

    // 初始化粒子 - 从顶部和底部同时发射
    particlesRef.current = Array.from({ length: PARTICLE_COUNT }, (_, i) => {
      const shape = (Math.random() > 0.5 ? 'rect' : 'circle') as 'rect' | 'circle'
      return {
        x: canvas.width * (0.2 + Math.random() * 0.6),
        y: i % 2 === 0 ? -20 : canvas.height + 20,
        vx: (Math.random() - 0.5) * 8,
        vy: i % 2 === 0 ? Math.random() * 4 + 2 : -(Math.random() * 4 + 2),
        size: Math.random() * 8 + 4,
        color: COLORS[Math.floor(Math.random() * COLORS.length)],
        rotation: Math.random() * Math.PI * 2,
        rotationSpeed: (Math.random() - 0.5) * 0.2,
        life: 0,
        maxLife: 60 + Math.random() * 80,
        shape
      }
    })

    let frame = 0
    const animate = () => {
      if (!ctx || !canvas) return
      ctx.clearRect(0, 0, canvas.width, canvas.height)

      const particles = particlesRef.current
      let alive = false

      for (const p of particles) {
        p.life++
        if (p.life > p.maxLife) continue
        alive = true

        p.x += p.vx
        p.vy += 0.12 // gravity
        p.y += p.vy
        p.vx *= 0.99
        p.rotation += p.rotationSpeed

        const alpha = 1 - p.life / p.maxLife
        ctx.save()
        ctx.translate(p.x, p.y)
        ctx.rotate(p.rotation)
        ctx.globalAlpha = alpha

        if (p.shape === 'rect') {
          ctx.fillStyle = p.color
          ctx.fillRect(-p.size / 2, -p.size / 4, p.size, p.size / 2)
        } else {
          ctx.fillStyle = p.color
          ctx.beginPath()
          ctx.arc(0, 0, p.size / 2, 0, Math.PI * 2)
          ctx.fill()
        }

        ctx.restore()
      }

      if (alive) {
        frame++

        // 每 40 帧补充一波粒子
        if (frame % 40 === 0 && frame < 200) {
          const burst = Array.from({ length: 30 }, () => {
            const shape = (Math.random() > 0.5 ? 'rect' : 'circle') as 'rect' | 'circle'
            return {
              x: canvas.width * (0.2 + Math.random() * 0.6),
              y: canvas.height / 2 + (Math.random() - 0.5) * 200,
              vx: (Math.random() - 0.5) * 12,
              vy: (Math.random() - 0.5) * 12,
              size: Math.random() * 6 + 3,
              color: COLORS[Math.floor(Math.random() * COLORS.length)],
              rotation: Math.random() * Math.PI * 2,
              rotationSpeed: (Math.random() - 0.5) * 0.3,
              life: 0,
              maxLife: 40 + Math.random() * 50,
              shape
            }
          })
          particlesRef.current.push(...burst)
        }

        animFrameRef.current = requestAnimationFrame(animate)
      }
    }

    animFrameRef.current = requestAnimationFrame(animate)

    return () => {
      cancelAnimationFrame(animFrameRef.current)
      window.removeEventListener('resize', resize)
    }
  }, [active])

  if (!active) return <></>

  return (
    <canvas
      ref={canvasRef}
      className="fixed inset-0 z-50 pointer-events-none"
    />
  )
}