import {
  forwardRef,
  useImperativeHandle,
  useMemo,
  useRef,
  useState,
  type KeyboardEvent,
} from 'react'
import { ArrowUpRight, LocateFixed, Search, X } from 'lucide-react'
import { formatLatitude, formatLongitude, makeCoordinateLocation } from '../data/marsData'
import type { MarsLocation } from '../types'

export type SearchNavigatorHandle = {
  focus: () => void
}

type SearchNavigatorProps = {
  locations: MarsLocation[]
  onSelect: (location: MarsLocation) => void
}

function parseCoordinates(query: string) {
  const normalized = query.trim().replaceAll('°', '')
  const match = normalized.match(
    /^\s*(-?\d+(?:\.\d+)?)\s*([NS])?\s*[,/]\s*(-?\d+(?:\.\d+)?)\s*([EW])?\s*$/i,
  )
  if (!match) return null

  let latitude = Number(match[1])
  let longitude = Number(match[3])
  if (match[2]?.toUpperCase() === 'S') latitude = -Math.abs(latitude)
  if (match[2]?.toUpperCase() === 'N') latitude = Math.abs(latitude)
  if (match[4]?.toUpperCase() === 'W') longitude = -Math.abs(longitude)
  if (match[4]?.toUpperCase() === 'E') longitude = Math.abs(longitude)
  if (Math.abs(latitude) > 90 || Math.abs(longitude) > 180) return null
  return makeCoordinateLocation(latitude, longitude)
}

export const SearchNavigator = forwardRef<SearchNavigatorHandle, SearchNavigatorProps>(
  function SearchNavigator({ locations, onSelect }, ref) {
    const inputRef = useRef<HTMLInputElement>(null)
    const [query, setQuery] = useState('')
    const [open, setOpen] = useState(false)
    const [activeIndex, setActiveIndex] = useState(0)

    useImperativeHandle(ref, () => ({
      focus: () => {
        inputRef.current?.focus()
        setOpen(true)
      },
    }))

    const results = useMemo(() => {
      const coordinate = parseCoordinates(query)
      const lowered = query.trim().toLowerCase()
      const matches = locations.filter((location) => {
        if (!lowered) return true
        return [location.name, location.mission, location.type, location.region]
          .filter(Boolean)
          .some((value) => value?.toLowerCase().includes(lowered))
      })
      return coordinate ? [coordinate, ...matches].slice(0, 5) : matches.slice(0, 5)
    }, [locations, query])

    const selectResult = (location: MarsLocation) => {
      setQuery(location.type === 'Coordinates' ? '' : location.name)
      setOpen(false)
      setActiveIndex(0)
      onSelect(location)
    }

    const handleKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
      if (event.key === 'ArrowDown') {
        event.preventDefault()
        setOpen(true)
        setActiveIndex((current) => Math.min(current + 1, results.length - 1))
      } else if (event.key === 'ArrowUp') {
        event.preventDefault()
        setActiveIndex((current) => Math.max(current - 1, 0))
      } else if (event.key === 'Enter' && results[activeIndex]) {
        event.preventDefault()
        selectResult(results[activeIndex])
      } else if (event.key === 'Escape') {
        setOpen(false)
        inputRef.current?.blur()
      }
    }

    return (
      <div
        className={`search-navigator ${open ? 'is-open' : ''}`}
        onBlur={(event) => {
          if (!event.currentTarget.contains(event.relatedTarget)) setOpen(false)
        }}
      >
        <Search size={17} strokeWidth={1.8} aria-hidden="true" />
        <input
          ref={inputRef}
          value={query}
          onChange={(event) => {
            setQuery(event.target.value)
            setOpen(true)
            setActiveIndex(0)
          }}
          onFocus={() => setOpen(true)}
          onKeyDown={handleKeyDown}
          placeholder="Search Mars locations, sites, coordinates..."
          aria-label="Search Mars"
          aria-expanded={open}
          aria-controls="mars-search-results"
          autoComplete="off"
        />
        <span className="search-shortcut" aria-hidden="true">/</span>
        {query && (
          <button
            type="button"
            className="search-clear"
            aria-label="Clear search"
            onMouseDown={(event) => event.preventDefault()}
            onClick={() => {
              setQuery('')
              inputRef.current?.focus()
            }}
          >
            <X size={15} />
          </button>
        )}

        {open && (
          <div className="search-results" id="mars-search-results" role="listbox">
            <div className="search-results-heading">
              <span>{query ? 'Navigation results' : 'Suggested destinations'}</span>
              <span>{results.length.toString().padStart(2, '0')}</span>
            </div>
            {results.length > 0 ? (
              results.map((location, index) => (
                <button
                  type="button"
                  role="option"
                  aria-selected={activeIndex === index}
                  className={`search-result ${activeIndex === index ? 'is-active' : ''}`}
                  key={location.id}
                  onMouseEnter={() => setActiveIndex(index)}
                  onMouseDown={(event) => event.preventDefault()}
                  onClick={() => selectResult(location)}
                >
                  <span className="result-icon">
                    {location.type === 'Coordinates' ? (
                      <LocateFixed size={16} />
                    ) : (
                      <span className="result-dot" />
                    )}
                  </span>
                  <span className="result-copy">
                    <strong>{location.name}</strong>
                    <small>
                      {formatLatitude(location.lat)} · {formatLongitude(location.lon)}
                    </small>
                    <em>{location.mission ?? location.type}</em>
                  </span>
                  <ArrowUpRight size={16} className="result-arrow" />
                </button>
              ))
            ) : (
              <div className="search-empty">
                <LocateFixed size={18} />
                <p>No catalogued site found.</p>
                <small>Try a location name or coordinates separated by a comma.</small>
              </div>
            )}
            <div className="search-help">
              <span>↑↓ Navigate</span>
              <span>↵ Fly to</span>
              <span>Esc Close</span>
            </div>
          </div>
        )}
      </div>
    )
  },
)
