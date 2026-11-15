import { NoColorSpace, type Texture } from 'three'

const heightTextures = new WeakMap<Texture, Texture>()

/**
 * Returns one shared, correctly configured copy of a height texture.
 *
 * Every globe overlay uses the same 8K MOLA height map. Cloning it once and
 * sharing the clone keeps GPU memory flat while leaving the loader-cached
 * source texture untouched.
 */
export function sharedHeightTexture(
  source: Texture,
  maxAnisotropy: number,
): Texture {
  const cached = heightTextures.get(source)
  if (cached) return cached

  const configured = source.clone()
  configured.colorSpace = NoColorSpace
  configured.anisotropy = Math.min(4, maxAnisotropy)
  configured.needsUpdate = true
  heightTextures.set(source, configured)
  return configured
}
