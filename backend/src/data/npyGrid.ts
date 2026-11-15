import { readFileSync } from 'node:fs'
import { join } from 'node:path'

export type NpyKind = 'int16' | 'float32'

export class NpyGrid {
  readonly rows: number
  readonly columns: number
  readonly dataOffset: number
  readonly kind: NpyKind
  readonly noData: number
  readonly min: number
  readonly max: number
  readonly validCount: number
  readonly missingCount: number
  private readonly file: Buffer

  private constructor(file: Buffer, dataOffset: number, kind: NpyKind, noData: number) {
    this.file = file
    this.dataOffset = dataOffset
    this.kind = kind
    this.noData = noData

    const itemBytes = kind === 'int16' ? 2 : 4
    const payloadBytes = file.length - dataOffset
    if (payloadBytes % itemBytes !== 0) throw new Error('NPY payload size is not aligned to its data type')
    this.rows = 1800
    this.columns = 3600
    if (payloadBytes !== this.rows * this.columns * itemBytes) {
      throw new Error(`Unexpected NPY payload size: ${payloadBytes}`)
    }

    let min = Number.POSITIVE_INFINITY
    let max = Number.NEGATIVE_INFINITY
    let validCount = 0
    const count = this.rows * this.columns
    for (let index = 0; index < count; index += 1) {
      const value = this.readIndex(index)
      if (!Number.isFinite(value) || value === noData) continue
      min = Math.min(min, value)
      max = Math.max(max, value)
      validCount += 1
    }
    if (validCount === 0) throw new Error('NPY grid contains no valid data')
    this.min = min
    this.max = max
    this.validCount = validCount
    this.missingCount = count - validCount
  }

  static load(directory: string, filename: string, kind: NpyKind, noData: number): NpyGrid {
    const file = readFileSync(join(directory, filename))
    if (!file.subarray(0, 6).equals(Buffer.from([0x93, 0x4e, 0x55, 0x4d, 0x50, 0x59]))) {
      throw new Error(`Invalid NPY file: ${filename}`)
    }
    const major = file[6]
    const minor = file[7]
    let headerLength: number
    let headerStart: number
    if (major === 1 && minor === 0) {
      headerLength = file.readUInt16LE(8)
      headerStart = 10
    } else if ((major === 2 || major === 3) && minor === 0) {
      headerLength = file.readUInt32LE(8)
      headerStart = 12
    } else {
      throw new Error(`Unsupported NPY version ${major}.${minor}: ${filename}`)
    }
    const headerEnd = headerStart + headerLength
    if (headerEnd > file.length) throw new Error(`Truncated NPY header: ${filename}`)
    const header = file.toString('latin1', headerStart, headerEnd)
    const dtype = header.match(/['"]descr['"]\s*:\s*['"]([^'"]+)['"]/)?.[1]
    const shape = header.match(/['"]shape['"]\s*:\s*\(\s*(\d+)\s*,\s*(\d+)\s*\)/)
    const fortranOrder = header.match(/['"]fortran_order['"]\s*:\s*(True|False)/)?.[1]
    const expectedDtype = kind === 'int16' ? '<i2' : '<f4'
    if (dtype !== expectedDtype || !shape || Number(shape[1]) !== 1800 || Number(shape[2]) !== 3600) {
      throw new Error(`Unexpected NPY dtype or shape in ${filename}`)
    }
    if (fortranOrder !== 'False') throw new Error(`Fortran-order NPY grids are not supported: ${filename}`)
    return new NpyGrid(file, headerEnd, kind, noData)
  }

  value(row: number, column: number): number | null {
    if (row < 0 || row >= this.rows || column < 0 || column >= this.columns) return null
    const value = this.readIndex(row * this.columns + column)
    return !Number.isFinite(value) || value === this.noData ? null : value
  }

  valueAt(index: number): number | null {
    if (index < 0 || index >= this.rows * this.columns) return null
    const value = this.readIndex(index)
    return !Number.isFinite(value) || value === this.noData ? null : value
  }

  private readIndex(index: number): number {
    const offset = this.dataOffset + index * (this.kind === 'int16' ? 2 : 4)
    return this.kind === 'int16' ? this.file.readInt16LE(offset) : this.file.readFloatLE(offset)
  }
}
