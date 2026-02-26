import { useEffect, useMemo, useRef, useState } from 'react'
import type { ForceAtlas2Settings } from 'graphology-layout-forceatlas2'
import { expandTitle } from './api'
import { GraphController } from './graph'

function App() {
  const containerRef = useRef<HTMLDivElement | null>(null)
  const graphRef = useRef<GraphController | null>(null)
  const [seed, setSeed] = useState('Graph theory')
  const [status, setStatus] = useState('Awaiting seed')
  const [hasGraph, setHasGraph] = useState(false)
  const [layoutSettings, setLayoutSettings] = useState<ForceAtlas2Settings>({
    adjustSizes: true,
    barnesHutOptimize: false,
    barnesHutTheta: 0.5,
    edgeWeightInfluence: 1,
    gravity: 1,
    linLogMode: false,
    outboundAttractionDistribution: false,
    scalingRatio: 1,
    slowDown: 1,
    strongGravityMode: false,
  })
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!containerRef.current) return
    graphRef.current = new GraphController({
      container: containerRef.current,
      onExpand: async (title) => {
        setIsLoading(true)
        setError(null)
        setStatus(`Expanding ${title}`)
        try {
          const payload = await expandTitle(title)
          setStatus(`Expanded ${payload.node.title}`)
          return payload
        } catch (err) {
          const message = err instanceof Error ? err.message : 'Expansion failed'
          setError(message)
          setStatus('Expansion failed')
          throw err
        } finally {
          setIsLoading(false)
        }
      },
    })

    return () => {
      graphRef.current?.destroy()
      graphRef.current = null
    }
  }, [])

  useEffect(() => {
    if (!graphRef.current) return
    graphRef.current.updateLayoutSettings(layoutSettings)
  }, [layoutSettings])

  const settingControls = useMemo(
    () => [
      {
        key: 'adjustSizes' as const,
        label: 'Adjust Sizes',
        type: 'boolean' as const,
      },
      {
        key: 'barnesHutOptimize' as const,
        label: 'Barnes-Hut Optimize',
        type: 'boolean' as const,
      },
      {
        key: 'barnesHutTheta' as const,
        label: 'Barnes-Hut Theta',
        type: 'number' as const,
        min: 0.1,
        max: 1.2,
        step: 0.05,
      },
      {
        key: 'edgeWeightInfluence' as const,
        label: 'Edge Weight Influence',
        type: 'number' as const,
        min: 0,
        max: 3,
        step: 0.1,
      },
      {
        key: 'gravity' as const,
        label: 'Gravity',
        type: 'number' as const,
        min: 0,
        max: 5,
        step: 0.1,
      },
      {
        key: 'linLogMode' as const,
        label: 'LinLog Mode',
        type: 'boolean' as const,
      },
      {
        key: 'outboundAttractionDistribution' as const,
        label: 'Outbound Attraction',
        type: 'boolean' as const,
      },
      {
        key: 'scalingRatio' as const,
        label: 'Scaling Ratio',
        type: 'number' as const,
        min: 0.1,
        max: 8,
        step: 0.1,
      },
      {
        key: 'slowDown' as const,
        label: 'Slow Down',
        type: 'number' as const,
        min: 0.1,
        max: 10,
        step: 0.1,
      },
      {
        key: 'strongGravityMode' as const,
        label: 'Strong Gravity',
        type: 'boolean' as const,
      },
    ],
    [],
  )

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (!graphRef.current || !seed.trim()) return
    setIsLoading(true)
    setError(null)
    try {
      await graphRef.current.seed(seed.trim())
      setHasGraph(true)
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to load seed'
      setError(message)
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="app">
      <header className="header">
        <div>
          <h1>Wikipedia Graph Explorer</h1>
          <span>Expand nodes to reveal the knowledge web</span>
        </div>
        <form className="controls" onSubmit={handleSubmit}>
          <input
            type="text"
            value={seed}
            onChange={(event) => setSeed(event.target.value)}
            placeholder="Seed article title"
          />
          <button type="submit" disabled={isLoading}>
            {isLoading ? 'Loading...' : 'Grow Graph'}
          </button>
          <button
            type="button"
            onClick={() => graphRef.current?.fitToGraph()}
            disabled={!hasGraph}
          >
            Fit View
          </button>
          <button
            type="button"
            onClick={() => {
              graphRef.current?.reset()
              setHasGraph(false)
              setStatus('Awaiting seed')
              setError(null)
            }}
            disabled={!hasGraph}
          >
            Reset
          </button>
        </form>
      </header>
      <main className="canvas">
        <div className="graph-container" ref={containerRef} />
        <div className="status">
          <strong>Status</strong> · {status}
        </div>
        <aside className="controls-panel">
          <div className="controls-panel__title">Layout Controls</div>
          {settingControls.map((control) => {
            if (control.type === 'boolean') {
              const checked = Boolean(layoutSettings[control.key])
              return (
                <label className="toggle" key={control.key}>
                  <input
                    type="checkbox"
                    checked={checked}
                    onChange={(event) =>
                      setLayoutSettings((prev) => ({
                        ...prev,
                        [control.key]: event.target.checked,
                      }))
                    }
                  />
                  <span>{control.label}</span>
                </label>
              )
            }

            const value = Number(layoutSettings[control.key] ?? 0)
            return (
              <label className="slider" key={control.key}>
                <div>
                  <span>{control.label}</span>
                  <span className="slider__value">{value.toFixed(2)}</span>
                </div>
                <input
                  type="range"
                  min={control.min}
                  max={control.max}
                  step={control.step}
                  value={value}
                  onChange={(event) =>
                    setLayoutSettings((prev) => ({
                      ...prev,
                      [control.key]: Number(event.target.value),
                    }))
                  }
                />
              </label>
            )
          })}
        </aside>
        {error ? <div className="error-banner">{error}</div> : null}
      </main>
    </div>
  )
}

export default App
