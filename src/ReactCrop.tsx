import React, { memo, useState, useRef, useEffect } from 'react'

import { Ords, XYOrds, Crop, PixelCrop, PercentCrop } from './types'
import {
  defaultCrop,
  clamp,
  cls,
  areCropsEqual,
  convertToPercentCrop,
  convertToPixelCrop,
  containCrop,
  nudgeCrop,
} from './utils'

import './ReactCrop.scss'

interface EVData {
  startClientX: number
  startClientY: number
  startCropX: number
  startCropY: number
  clientX: number
  clientY: number
  isResize: boolean
  ord?: Ords
}

interface Rectangle {
  x: number
  y: number
  width: number
  height: number
}

const DOC_MOVE_OPTS = { capture: true, passive: false }
let instanceCount = 0

const xOrds = ['e', 'w']
const yOrds = ['n', 's']
const xyOrds = ['nw', 'ne', 'se', 'sw']

const nudgeStep = 1
const nudgeStepMedium = 10
const nudgeStepLarge = 100

const defaultAriaLabels = {
  cropArea: 'Use the arrow keys to move the crop selection area',
  nwDragHandle: 'Use the arrow keys to move the north west drag handle to change the crop selection area',
  nDragHandle: 'Use the up and down arrow keys to move the north drag handle to change the crop selection area',
  neDragHandle: 'Use the arrow keys to move the north east drag handle to change the crop selection area',
  eDragHandle: 'Use the up and down arrow keys to move the east drag handle to change the crop selection area',
  seDragHandle: 'Use the arrow keys to move the south east drag handle to change the crop selection area',
  sDragHandle: 'Use the up and down arrow keys to move the south drag handle to change the crop selection area',
  swDragHandle: 'Use the arrow keys to move the south west drag handle to change the crop selection area',
  wDragHandle: 'Use the up and down arrow keys to move the west drag handle to change the crop selection area',
}

export interface ReactCropProps {
  /** An object of labels to override the built-in English ones */
  ariaLabels?: {
    cropArea: string
    nwDragHandle: string
    nDragHandle: string
    neDragHandle: string
    eDragHandle: string
    seDragHandle: string
    sDragHandle: string
    swDragHandle: string
    wDragHandle: string
  }
  /** The aspect ratio of the crop, e.g. `1` for a square or `16 / 9` for landscape. */
  aspect?: number
  /** Classes to pass to the `ReactCrop` element. */
  className?: string
  /** The elements that you want to perform a crop on. For example
   * an image or video. */
  children?: React.ReactNode
  /** Show the crop area as a circle. If your aspect is not 1 (a square) then the circle will be warped into an oval shape. Defaults to false. */
  circularCrop?: boolean
  /** Since v10 all crop params are required except for aspect. Omit the entire crop object if you don't want a crop. See README on how to create an aspect crop with a % crop. */
  crop?: Crop
  /** If true then the user cannot resize or draw a new crop. A class of `ReactCrop--disabled` is also added to the container for user styling. */
  disabled?: boolean
  /** If true then the user cannot create or resize a crop, but can still drag the existing crop around. A class of `ReactCrop--locked` is also added to the container for user styling. */
  locked?: boolean
  /** If true is passed then selection can't be disabled if the user clicks outside the selection area. */
  keepSelection?: boolean
  /** A minimum crop width, in pixels. */
  minWidth?: number
  /** A minimum crop height, in pixels. */
  minHeight?: number
  /** A maximum crop width, in pixels. */
  maxWidth?: number
  /** A maximum crop height, in pixels. */
  maxHeight?: number
  /** A callback which happens for every change of the crop. You should set the crop to state and pass it back into the library via the `crop` prop. */
  onChange: (crop: PixelCrop, percentageCrop: PercentCrop) => void
  /** A callback which happens after a resize, drag, or nudge. Passes the current crop state object in pixels and percent. */
  onComplete?: (crop: PixelCrop, percentageCrop: PercentCrop) => void
  /** A callback which happens when a user starts dragging or resizing. It is convenient to manipulate elements outside this component. */
  onDragStart?: (e: PointerEvent) => void
  /** A callback which happens when a user releases the cursor or touch after dragging or resizing. */
  onDragEnd?: (e: PointerEvent) => void
  /** Render a custom element in crop selection. */
  renderSelectionAddon?: (state: ReactCropState) => React.ReactNode
  /** Show rule of thirds lines in the cropped area. Defaults to false. */
  ruleOfThirds?: boolean
  /** Inline styles object to be passed to the `ReactCrop` element. */
  style?: React.CSSProperties
}

export interface ReactCropState {
  cropIsActive: boolean
  newCropIsBeingDrawn: boolean
}

const ReactCropComponent = ({
  ariaLabels = defaultAriaLabels,
  aspect,
  children,
  circularCrop,
  className,
  crop,
  disabled,
  locked,
  keepSelection,
  minWidth = 0,
  minHeight = 0,
  maxWidth,
  maxHeight,
  onChange,
  onComplete,
  onDragStart,
  onDragEnd,
  renderSelectionAddon,
  ruleOfThirds,
  style,
}: ReactCropProps) => {
  // State
  const [cropIsActive, setCropIsActive] = useState(false)
  const [newCropIsBeingDrawn, setNewCropIsBeingDrawn] = useState(false)

  // Refs for mutable values
  const componentRef = useRef<HTMLDivElement>(null)
  const mediaRef = useRef<HTMLDivElement>(null)
  const docMoveBound = useRef(false)
  const mouseDownOnCrop = useRef(false)
  const dragStarted = useRef(false)
  const evData = useRef<EVData>({
    startClientX: 0,
    startClientY: 0,
    startCropX: 0,
    startCropY: 0,
    clientX: 0,
    clientY: 0,
    isResize: true,
  })
  const resizeObserver = useRef<ResizeObserver | undefined>(undefined)
  const instanceId = useRef(`rc-${instanceCount++}`)
  const prevCropRef = useRef<Crop | undefined>(undefined)

  // We unfortunately get the bounding box every time as x+y changes
  // due to scrolling.
  const getBox = (): Rectangle => {
    const el = mediaRef.current
    if (!el) {
      return { x: 0, y: 0, width: 0, height: 0 }
    }
    const { x, y, width, height } = el.getBoundingClientRect()
    return { x, y, width, height }
  }

  const makePixelCrop = (box: Rectangle) => {
    const cropData = { ...defaultCrop, ...(crop || {}) }
    return convertToPixelCrop(cropData, box.width, box.height)
  }

  const bindDocMove = () => {
    if (docMoveBound.current) {
      return
    }

    document.addEventListener('pointermove', onDocPointerMove, DOC_MOVE_OPTS)
    document.addEventListener('pointerup', onDocPointerDone, DOC_MOVE_OPTS)
    document.addEventListener('pointercancel', onDocPointerDone, DOC_MOVE_OPTS)

    docMoveBound.current = true
  }

  const unbindDocMove = () => {
    if (!docMoveBound.current) {
      return
    }

    document.removeEventListener('pointermove', onDocPointerMove, DOC_MOVE_OPTS)
    document.removeEventListener('pointerup', onDocPointerDone, DOC_MOVE_OPTS)
    document.removeEventListener('pointercancel', onDocPointerDone, DOC_MOVE_OPTS)

    docMoveBound.current = false
  }

  const getCropStyle = () => {
    if (!crop) {
      return undefined
    }

    return {
      top: `${crop.y}${crop.unit}`,
      left: `${crop.x}${crop.unit}`,
      width: `${crop.width}${crop.unit}`,
      height: `${crop.height}${crop.unit}`,
    }
  }

  const dragCrop = () => {
    const box = getBox()
    const nextCrop = makePixelCrop(box)
    const xDiff = evData.current.clientX - evData.current.startClientX
    const yDiff = evData.current.clientY - evData.current.startClientY

    nextCrop.x = clamp(evData.current.startCropX + xDiff, 0, box.width - nextCrop.width)
    nextCrop.y = clamp(evData.current.startCropY + yDiff, 0, box.height - nextCrop.height)

    return nextCrop
  }

  const getPointRegion = (box: Rectangle, origOrd: Ords | undefined, minW: number, minH: number): XYOrds => {
    const relativeX = evData.current.clientX - box.x
    const relativeY = evData.current.clientY - box.y

    let topHalf: boolean
    if (minH && origOrd) {
      // Uses orig ord (never flip when minHeight != 0)
      topHalf = origOrd === 'nw' || origOrd === 'n' || origOrd === 'ne'
    } else {
      topHalf = relativeY < evData.current.startCropY
    }

    let leftHalf: boolean
    if (minW && origOrd) {
      // Uses orig ord (never flip when minWidth != 0)
      leftHalf = origOrd === 'nw' || origOrd === 'w' || origOrd === 'sw'
    } else {
      leftHalf = relativeX < evData.current.startCropX
    }

    if (leftHalf) {
      return topHalf ? 'nw' : 'sw'
    } else {
      return topHalf ? 'ne' : 'se'
    }
  }

  const resolveMinDimensions = (box: Rectangle, aspectRatio: number, minW = 0, minH = 0) => {
    const mw = Math.min(minW, box.width)
    const mh = Math.min(minH, box.height)

    if (!aspectRatio || (!mw && !mh)) {
      return [mw, mh]
    }

    if (aspectRatio > 1) {
      return mw ? [mw, mw / aspectRatio] : [mh * aspectRatio, mh]
    } else {
      return mh ? [mh * aspectRatio, mh] : [mw, mw / aspectRatio]
    }
  }

  const resizeCrop = () => {
    const aspectRatio = aspect || 0
    const box = getBox()
    const [resolvedMinWidth, resolvedMinHeight] = resolveMinDimensions(box, aspectRatio, minWidth, minHeight)
    let nextCrop = makePixelCrop(box)
    const area = getPointRegion(box, evData.current.ord, resolvedMinWidth, resolvedMinHeight)
    const ord = evData.current.ord || area
    let xDiff = evData.current.clientX - evData.current.startClientX
    let yDiff = evData.current.clientY - evData.current.startClientY

    // When min dimensions are set, ensure crop isn't dragged when going
    // beyond the other side #554
    if ((resolvedMinWidth && ord === 'nw') || ord === 'w' || ord === 'sw') {
      xDiff = Math.min(xDiff, -resolvedMinWidth)
    }

    if ((resolvedMinHeight && ord === 'nw') || ord === 'n' || ord === 'ne') {
      yDiff = Math.min(yDiff, -resolvedMinHeight)
    }

    const tmpCrop: PixelCrop = {
      unit: 'px',
      x: 0,
      y: 0,
      width: 0,
      height: 0,
    }

    if (area === 'ne') {
      tmpCrop.x = evData.current.startCropX
      tmpCrop.width = xDiff

      if (aspectRatio) {
        tmpCrop.height = tmpCrop.width / aspectRatio
        tmpCrop.y = evData.current.startCropY - tmpCrop.height
      } else {
        tmpCrop.height = Math.abs(yDiff)
        tmpCrop.y = evData.current.startCropY - tmpCrop.height
      }
    } else if (area === 'se') {
      tmpCrop.x = evData.current.startCropX
      tmpCrop.y = evData.current.startCropY
      tmpCrop.width = xDiff

      if (aspectRatio) {
        tmpCrop.height = tmpCrop.width / aspectRatio
      } else {
        tmpCrop.height = yDiff
      }
    } else if (area === 'sw') {
      tmpCrop.x = evData.current.startCropX + xDiff
      tmpCrop.y = evData.current.startCropY
      tmpCrop.width = Math.abs(xDiff)

      if (aspectRatio) {
        tmpCrop.height = tmpCrop.width / aspectRatio
      } else {
        tmpCrop.height = yDiff
      }
    } else if (area === 'nw') {
      tmpCrop.x = evData.current.startCropX + xDiff
      tmpCrop.width = Math.abs(xDiff)

      if (aspectRatio) {
        tmpCrop.height = tmpCrop.width / aspectRatio
        tmpCrop.y = evData.current.startCropY - tmpCrop.height
      } else {
        tmpCrop.height = Math.abs(yDiff)
        tmpCrop.y = evData.current.startCropY + yDiff
      }
    }

    const containedCrop = containCrop(
      tmpCrop,
      aspectRatio,
      area,
      box.width,
      box.height,
      resolvedMinWidth,
      resolvedMinHeight,
      maxWidth,
      maxHeight
    )

    // Apply x/y/width/height changes depending on ordinate
    // (fixed aspect always applies both).
    if (aspectRatio || xyOrds.indexOf(ord) > -1) {
      nextCrop = containedCrop
    } else if (xOrds.indexOf(ord) > -1) {
      nextCrop.x = containedCrop.x
      nextCrop.width = containedCrop.width
    } else if (yOrds.indexOf(ord) > -1) {
      nextCrop.y = containedCrop.y
      nextCrop.height = containedCrop.height
    }

    // When drawing a new crop with min dimensions we allow flipping, but
    // ensure we don't flip outside the crop area, just ignore those.
    nextCrop.x = clamp(nextCrop.x, 0, box.width - nextCrop.width)
    nextCrop.y = clamp(nextCrop.y, 0, box.height - nextCrop.height)

    return nextCrop
  }

  const onCropPointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    const box = getBox()

    if (!crop) {
      return
    }

    const pixelCrop = convertToPixelCrop(crop, box.width, box.height)

    if (disabled) {
      return
    }

    if (e.cancelable) e.preventDefault() // Stop drag selection.

    // Bind to doc to follow movements outside of element.
    bindDocMove()

    // Focus for detecting keypress.
    componentRef.current?.focus({ preventScroll: true })

    const ord = (e.target as HTMLElement).dataset.ord as Ords
    const isResize = Boolean(ord)
    let startClientX = e.clientX
    let startClientY = e.clientY
    let startCropX = pixelCrop.x
    let startCropY = pixelCrop.y

    // Set the starting coords to the opposite corner.
    if (ord) {
      const relativeX = e.clientX - box.x
      const relativeY = e.clientY - box.y
      let fromCornerX = 0
      let fromCornerY = 0

      if (ord === 'ne' || ord == 'e') {
        fromCornerX = relativeX - (pixelCrop.x + pixelCrop.width)
        fromCornerY = relativeY - pixelCrop.y
        startCropX = pixelCrop.x
        startCropY = pixelCrop.y + pixelCrop.height
      } else if (ord === 'se' || ord === 's') {
        fromCornerX = relativeX - (pixelCrop.x + pixelCrop.width)
        fromCornerY = relativeY - (pixelCrop.y + pixelCrop.height)
        startCropX = pixelCrop.x
        startCropY = pixelCrop.y
      } else if (ord === 'sw' || ord == 'w') {
        fromCornerX = relativeX - pixelCrop.x
        fromCornerY = relativeY - (pixelCrop.y + pixelCrop.height)
        startCropX = pixelCrop.x + pixelCrop.width
        startCropY = pixelCrop.y
      } else if (ord === 'nw' || ord == 'n') {
        fromCornerX = relativeX - pixelCrop.x
        fromCornerY = relativeY - pixelCrop.y
        startCropX = pixelCrop.x + pixelCrop.width
        startCropY = pixelCrop.y + pixelCrop.height
      }

      startClientX = startCropX + box.x + fromCornerX
      startClientY = startCropY + box.y + fromCornerY
    }

    evData.current = {
      startClientX,
      startClientY,
      startCropX,
      startCropY,
      clientX: e.clientX,
      clientY: e.clientY,
      isResize,
      ord,
    }

    mouseDownOnCrop.current = true
    setCropIsActive(true)
  }

  const onComponentPointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    const box = getBox()

    if (disabled || locked || (keepSelection && crop)) {
      return
    }

    if (e.cancelable) e.preventDefault() // Stop drag selection.

    // Bind to doc to follow movements outside of element.
    bindDocMove()

    // Focus for detecting keypress.
    componentRef.current?.focus({ preventScroll: true })

    const cropX = e.clientX - box.x
    const cropY = e.clientY - box.y
    const nextCrop: PixelCrop = {
      unit: 'px',
      x: cropX,
      y: cropY,
      width: 0,
      height: 0,
    }

    evData.current = {
      startClientX: e.clientX,
      startClientY: e.clientY,
      startCropX: cropX,
      startCropY: cropY,
      clientX: e.clientX,
      clientY: e.clientY,
      isResize: true,
    }

    mouseDownOnCrop.current = true

    onChange(convertToPixelCrop(nextCrop, box.width, box.height), convertToPercentCrop(nextCrop, box.width, box.height))

    setCropIsActive(true)
    setNewCropIsBeingDrawn(true)
  }

  const onDocPointerMove = (e: PointerEvent) => {
    const box = getBox()

    if (disabled || !crop || !mouseDownOnCrop.current) {
      return
    }

    // Stop drag selection.
    if (e.cancelable) e.preventDefault()

    if (!dragStarted.current) {
      dragStarted.current = true
      if (onDragStart) {
        onDragStart(e)
      }
    }

    // Update pointer position.
    evData.current.clientX = e.clientX
    evData.current.clientY = e.clientY

    let nextCrop

    if (evData.current.isResize) {
      nextCrop = resizeCrop()
    } else {
      nextCrop = dragCrop()
    }

    if (!areCropsEqual(crop, nextCrop)) {
      onChange(
        convertToPixelCrop(nextCrop, box.width, box.height),
        convertToPercentCrop(nextCrop, box.width, box.height)
      )
    }
  }

  const onComponentKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    if (disabled) {
      return
    }

    const keyCode = e.key
    let nudged = false

    if (!crop) {
      return
    }

    const box = getBox()
    const nextCrop = makePixelCrop(box)
    const ctrlCmdPressed = navigator.platform.match('Mac') ? e.metaKey : e.ctrlKey
    const nudgeStepValue = ctrlCmdPressed ? nudgeStepLarge : e.shiftKey ? nudgeStepMedium : nudgeStep

    if (keyCode === 'ArrowLeft') {
      nextCrop.x -= nudgeStepValue
      nudged = true
    } else if (keyCode === 'ArrowRight') {
      nextCrop.x += nudgeStepValue
      nudged = true
    } else if (keyCode === 'ArrowUp') {
      nextCrop.y -= nudgeStepValue
      nudged = true
    } else if (keyCode === 'ArrowDown') {
      nextCrop.y += nudgeStepValue
      nudged = true
    }

    if (nudged) {
      if (e.cancelable) e.preventDefault() // Stop drag selection.

      nextCrop.x = clamp(nextCrop.x, 0, box.width - nextCrop.width)
      nextCrop.y = clamp(nextCrop.y, 0, box.height - nextCrop.height)

      const pixelCrop = convertToPixelCrop(nextCrop, box.width, box.height)
      const percentCrop = convertToPercentCrop(nextCrop, box.width, box.height)

      onChange(pixelCrop, percentCrop)
      if (onComplete) {
        onComplete(pixelCrop, percentCrop)
      }
    }
  }

  const onHandlerKeyDown = (e: React.KeyboardEvent<HTMLDivElement>, ord: Ords) => {
    const box = getBox()

    if (disabled || !crop) {
      return
    }

    // Keep the event from bubbling up to the container
    if (e.key === 'ArrowUp' || e.key === 'ArrowDown' || e.key === 'ArrowLeft' || e.key === 'ArrowRight') {
      e.stopPropagation()
      e.preventDefault()
    } else {
      return
    }

    const ctrlCmdPressed = navigator.platform.match('Mac') ? e.metaKey : e.ctrlKey
    const offset = ctrlCmdPressed ? nudgeStepLarge : e.shiftKey ? nudgeStepMedium : nudgeStep

    const pixelCrop = convertToPixelCrop(crop, box.width, box.height)
    const nudgedCrop = nudgeCrop(pixelCrop, e.key, offset, ord)
    const containedCrop = containCrop(
      nudgedCrop,
      aspect || 0,
      ord,
      box.width,
      box.height,
      minWidth,
      minHeight,
      maxWidth,
      maxHeight
    )

    if (!areCropsEqual(crop, containedCrop)) {
      const percentCrop = convertToPercentCrop(containedCrop, box.width, box.height)
      onChange(containedCrop, percentCrop)

      if (onComplete) {
        onComplete(containedCrop, percentCrop)
      }
    }
  }

  const onDocPointerDone = (e: PointerEvent) => {
    const box = getBox()

    unbindDocMove()

    if (disabled || !crop) {
      return
    }

    if (mouseDownOnCrop.current) {
      mouseDownOnCrop.current = false
      dragStarted.current = false

      onDragEnd && onDragEnd(e)
      onComplete &&
        onComplete(convertToPixelCrop(crop, box.width, box.height), convertToPercentCrop(crop, box.width, box.height))

      setCropIsActive(false)
      setNewCropIsBeingDrawn(false)
    }
  }

  const onDragFocus = () => {
    // Fixes #491
    componentRef.current?.scrollTo(0, 0)
  }

  const renderCropSelection = () => {
    const cropStyle = getCropStyle()

    if (!crop) {
      return undefined
    }

    const state: ReactCropState = { cropIsActive, newCropIsBeingDrawn }

    return (
      <div
        style={cropStyle}
        className="ReactCrop__crop-selection"
        onPointerDown={onCropPointerDown}
        aria-label={ariaLabels.cropArea}
        tabIndex={0}
        onKeyDown={onComponentKeyDown}
        role="group"
      >
        {!disabled && !locked && (
          <div className="ReactCrop__drag-elements" onFocus={onDragFocus}>
            <div className="ReactCrop__drag-bar ord-n" data-ord="n" />
            <div className="ReactCrop__drag-bar ord-e" data-ord="e" />
            <div className="ReactCrop__drag-bar ord-s" data-ord="s" />
            <div className="ReactCrop__drag-bar ord-w" data-ord="w" />

            <div
              className="ReactCrop__drag-handle ord-nw"
              data-ord="nw"
              tabIndex={0}
              aria-label={ariaLabels.nwDragHandle}
              onKeyDown={e => onHandlerKeyDown(e, 'nw')}
              role="button"
            />
            <div
              className="ReactCrop__drag-handle ord-n"
              data-ord="n"
              tabIndex={0}
              aria-label={ariaLabels.nDragHandle}
              onKeyDown={e => onHandlerKeyDown(e, 'n')}
              role="button"
            />
            <div
              className="ReactCrop__drag-handle ord-ne"
              data-ord="ne"
              tabIndex={0}
              aria-label={ariaLabels.neDragHandle}
              onKeyDown={e => onHandlerKeyDown(e, 'ne')}
              role="button"
            />
            <div
              className="ReactCrop__drag-handle ord-e"
              data-ord="e"
              tabIndex={0}
              aria-label={ariaLabels.eDragHandle}
              onKeyDown={e => onHandlerKeyDown(e, 'e')}
              role="button"
            />
            <div
              className="ReactCrop__drag-handle ord-se"
              data-ord="se"
              tabIndex={0}
              aria-label={ariaLabels.seDragHandle}
              onKeyDown={e => onHandlerKeyDown(e, 'se')}
              role="button"
            />
            <div
              className="ReactCrop__drag-handle ord-s"
              data-ord="s"
              tabIndex={0}
              aria-label={ariaLabels.sDragHandle}
              onKeyDown={e => onHandlerKeyDown(e, 's')}
              role="button"
            />
            <div
              className="ReactCrop__drag-handle ord-sw"
              data-ord="sw"
              tabIndex={0}
              aria-label={ariaLabels.swDragHandle}
              onKeyDown={e => onHandlerKeyDown(e, 'sw')}
              role="button"
            />
            <div
              className="ReactCrop__drag-handle ord-w"
              data-ord="w"
              tabIndex={0}
              aria-label={ariaLabels.wDragHandle}
              onKeyDown={e => onHandlerKeyDown(e, 'w')}
              role="button"
            />
          </div>
        )}
        {renderSelectionAddon && (
          <div className="ReactCrop__selection-addon" onPointerDown={e => e.stopPropagation()}>
            {renderSelectionAddon(state)}
          </div>
        )}
        {ruleOfThirds && (
          <>
            <div className="ReactCrop__rule-of-thirds-hz" />
            <div className="ReactCrop__rule-of-thirds-vt" />
          </>
        )}
      </div>
    )
  }

  // Effect to handle componentDidUpdate logic
  useEffect(() => {
    // Useful for when programatically setting a new
    // crop and wanting to show a preview.
    if (onComplete && !prevCropRef.current && crop) {
      const { width, height } = getBox()
      if (width && height) {
        onComplete(convertToPixelCrop(crop, width, height), convertToPercentCrop(crop, width, height))
      }
    }
    prevCropRef.current = crop
  }, [crop, onComplete])

  // Effect to handle componentWillUnmount logic
  useEffect(() => {
    return () => {
      if (resizeObserver.current) {
        resizeObserver.current.disconnect()
      }
      unbindDocMove()
    }
  }, [])

  const cropSelection = crop ? renderCropSelection() : null

    const componentClasses = cls(
      'ReactCrop',
      className,
      cropIsActive && 'ReactCrop--active',
      disabled && 'ReactCrop--disabled',
      locked && 'ReactCrop--locked',
      newCropIsBeingDrawn && 'ReactCrop--new-crop',
      crop && aspect && 'ReactCrop--fixed-aspect',
      crop && circularCrop && 'ReactCrop--circular-crop',
      crop && ruleOfThirds && 'ReactCrop--rule-of-thirds',
    !dragStarted.current && crop && !crop.width && !crop.height && 'ReactCrop--invisible-crop',
      circularCrop && 'ReactCrop--no-animate'
    )

    return (
    <div ref={componentRef} className={componentClasses} style={style}>
      <div ref={mediaRef} className="ReactCrop__child-wrapper" onPointerDown={onComponentPointerDown}>
          {children}
        </div>
        {crop ? (
          <svg className="ReactCrop__crop-mask" width="100%" height="100%">
            <defs>
            <mask id={`hole-${instanceId.current}`}>
                <rect width="100%" height="100%" fill="white" />
                {circularCrop ? (
                  <ellipse
                    cx={`${crop.x + crop.width / 2}${crop.unit}`}
                    cy={`${crop.y + crop.height / 2}${crop.unit}`}
                    rx={`${crop.width / 2}${crop.unit}`}
                    ry={`${crop.height / 2}${crop.unit}`}
                    fill="black"
                  />
                ) : (
                  <rect
                    x={`${crop.x}${crop.unit}`}
                    y={`${crop.y}${crop.unit}`}
                    width={`${crop.width}${crop.unit}`}
                    height={`${crop.height}${crop.unit}`}
                    fill="black"
                  />
                )}
              </mask>
            </defs>
          <rect fill="black" fillOpacity={0.5} width="100%" height="100%" mask={`url(#hole-${instanceId.current})`} />
          </svg>
        ) : undefined}
        {cropSelection}
      </div>
    )
  }

export const ReactCrop = memo(ReactCropComponent)
