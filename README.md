# React Image Crop

An image cropping tool for React with no dependencies.

[![React Image Crop on NPM](https://img.shields.io/npm/v/react-image-crop.svg)](https://www.npmjs.com/package/react-image-crop)

[CodeSandbox Demo](https://codesandbox.io/s/react-image-crop-demo-with-react-hooks-y831o)

![ReactCrop GIF](https://raw.githubusercontent.com/dominictobias/react-image-crop/master/crop-demo.gif)

## Table of Contents

1. [Features](#features)
2. [Installation](#installation)
3. [Usage](#usage)
4. [Example](#example)
5. [CDN](#cdn)
6. [Props](#props)
7. [FAQ](#faq)
   1. [How can I generate a crop preview in the browser?](#how-can-i-generate-a-crop-preview-in-the-browser)
   2. [How to correct image EXIF orientation/rotation?](#how-to-correct-image-exif-orientationrotation)
   3. [How to filter, rotate and annotate?](#how-to-filter-rotate-and-annotate)
   4. [How can I center the crop?](#how-can-i-center-the-crop)
8. [Contributing / Developing](#contributing--developing)

## Features

- Responsive (you can use pixels or percentages).
- Touch enabled.
- Free-form or fixed aspect crops.
- Fully keyboard accessible (a11y).
- No dependencies/small footprint (<5KB gzip).
- Min/max crop size.
- Crop anything, not just images.

If React Crop doesn't cover your requirements then take a look at [Pintura](https://pqina.nl/pintura/?ref=react-image-crop) (our sponsor). It features cropping, rotating, filtering, annotation, and lots more.

[Learn more about Pintura here](https://pqina.nl/pintura/?ref=react-image-crop)

## Installation

```
npm i react-image-crop --save
yarn add react-image-crop
pnpm add react-image-crop
```

This library works with all modern browsers. It does not work with IE.

## Usage

Include the main js module:

```js
import ReactCrop from 'react-image-crop'
```

Include either `dist/ReactCrop.css` or `ReactCrop.scss`.

```js
import 'react-image-crop/dist/ReactCrop.css'
// or scss:
import 'react-image-crop/src/ReactCrop.scss'
```

## Example

```tsx
import ReactCrop, { type Crop } from 'react-image-crop'

function CropDemo({ src }) {
  const [crop, setCrop] = useState<Crop>()
  return (
    <ReactCrop crop={crop} onChange={c => setCrop(c)}>
      <img src={src} />
    </ReactCrop>
  )
}
```

See the [sandbox demo](https://codesandbox.io/s/react-image-crop-demo-with-react-hooks-y831o) for a more complete example.

## CDN

```html
<link href="https://unpkg.com/react-image-crop/dist/ReactCrop.css" rel="stylesheet" />
<script src="https://unpkg.com/react-image-crop/dist/index.umd.cjs"></script>
```

Note when importing the script globally using a `<script>` tag access the component with `ReactCrop.Component`.

## Props

**`onChange: (crop: PixelCrop, percentCrop: PercentCrop) => void`**

A callback which happens for every change of the crop (i.e. many times as you are dragging/resizing). Passes the current crop state object.

Note you _must_ implement this callback and update your crop state, otherwise nothing will change!

```tsx
<ReactCrop crop={crop} onChange={(crop, percentCrop) => setCrop(crop)} />
```

`crop` and `percentCrop` are interchangeable. `crop` uses pixels and `percentCrop` uses percentages to position and size itself. Percent crops are resistant to image/media resizing.

**`crop?: Crop`**

Starting with no crop:

```tsx
const [crop, setCrop] = useState<Crop>()

<ReactCrop crop={crop} onChange={c => setCrop(c)}>
  <img src={src} />
</ReactCrop>
```

Starting with a preselected crop:

```tsx
const [crop, setCrop] = useState<Crop>({
  unit: '%', // Can be 'px' or '%'
  x: 25,
  y: 25,
  width: 50,
  height: 50
})

<ReactCrop crop={crop} onChange={c => setCrop(c)}>
  <img src={src} />
</ReactCrop>
```

⚠️ You must ensure the crop is in bounds and correct to the aspect ratio if manually setting. Aspect ratios can be tricky when using %. You can make use of `centerCrop` and `makeAspectCrop` helpers. See [How can I center the crop?](#how-can-i-center-the-crop) or the [CodeSanbox Demo](https://codesandbox.io/s/react-image-crop-demo-with-react-hooks-y831o) for examples.

**`aspect?: number`**

The aspect ratio of the crop, e.g. `1` for a square or `16 / 9` for landscape. Omit/pass undefined for a free-form crop.

**`minWidth?: number`**

A minimum crop width, in pixels.

**`minHeight?: number`**

A minimum crop height, in pixels.

**`maxWidth?: number`**

A maximum crop width, in pixels.

**`maxHeight?: number`**

A maximum crop height, in pixels.

**`keepSelection?: boolean`**

If true is passed then selection can't be disabled if the user clicks outside the selection area.

**`disabled?: boolean`**

If true then the user cannot resize or draw a new crop. A class of `ReactCrop--disabled` is also added to the container for user styling.

**`locked?: boolean`**

If true then the user cannot create or resize a crop, but can still drag the existing crop around. A class of `ReactCrop--locked` is also added to the container for user styling.

**`className?: string`**

A string of classes to add to the main `ReactCrop` element.

**`style?: React.CSSProperties`**

Inline styles object to be passed to the image wrapper element.

**`onComplete?: (crop: PixelCrop, percentCrop: PercentCrop) => void`**

A callback which happens after a resize, drag, or nudge. Passes the current crop state object.

`percentCrop` is the crop as a percentage. A typical use case for it would be to save it so that the user's crop can be restored regardless of the size of the image (for example saving it on desktop, and then using it on a mobile where the image is smaller).

**`onDragStart?: (e: PointerEvent) => void`**

A callback which happens when a user starts dragging or resizing. It is convenient to manipulate elements outside this component.

**`onDragEnd?: (e: PointerEvent) => void`**

A callback which happens when a user releases the cursor or touch after dragging or resizing.

**`renderSelectionAddon?: (state: ReactCropState) => React.ReactNode`**

Render a custom element inside the crop selection.

**`ruleOfThirds?: boolean`**

Show [rule of thirds](https://en.wikipedia.org/wiki/Rule_of_thirds) lines in the cropped area. Defaults to `false`.

**`circularCrop?: boolean`**

Show the crop area as a circle. If your `aspect` is not `1` (a square) then the circle will be warped into an oval shape. Defaults to `false`.

## FAQ

### How can I generate a crop preview in the browser?

This isn't part of the library but there is an example over here [CodeSandbox Demo](https://codesandbox.io/s/react-image-crop-demo-with-react-hooks-y831o).

### How to correct image EXIF orientation/rotation?

You might find that some images are rotated incorrectly. Unfortunately this is a browser wide issue not related to this library. You need to fix your image before passing it in.

You can use the following library to load images, which will correct the rotation for you: https://github.com/blueimp/JavaScript-Load-Image/

You can read an issue on this subject here: https://github.com/dominictobias/react-image-crop/issues/181

If you're looking for a complete out of the box image editor which already handles EXIF rotation then consider using [Pintura](https://pqina.nl/pintura/?ref=react-image-crop).

<h3>How to filter, rotate and annotate?</h3>

This library is deliberately lightweight and minimal for you to build features on top of. If you wish to perform more advanced image editing out of the box then consider using [Pintura](https://pqina.nl/pintura/?ref=react-image-crop).

![Pintura Demo](https://raw.githubusercontent.com/DominicTobias/react-image-crop/master/doka-demo.gif)

### How can I center the crop?

The easiest way is to use the percentage unit:

```js
crop: {
  unit: '%',
  width: 50,
  height: 50,
  x: 25,
  y: 25
}
```

Centering an aspect ratio crop is trickier especially when dealing with `%`. However two helper functions are provided:

1. Listen to the load event of your media to get its size:

```jsx
<ReactCrop crop={crop} aspect={16 / 9}>
  <img src={src} onLoad={onImageLoad} />
</ReactCrop>
```

2. Use `makeAspectCrop` to create your desired aspect and then `centerCrop` to center it:

```js
function onImageLoad(e) {
  const { naturalWidth: width, naturalHeight: height } = e.currentTarget

  const crop = centerCrop(
    makeAspectCrop(
      {
        // You don't need to pass a complete crop into
        // makeAspectCrop or centerCrop.
        unit: '%',
        width: 90,
      },
      16 / 9,
      width,
      height
    ),
    width,
    height
  )

  setCrop(crop)
}
```

Also remember to set your crop using the percentCrop on changes:

```js
const onCropChange = (crop, percentCrop) => setCrop(percentCrop)
```

And your `aspect` prop should be set to the same value: `<ReactCrop aspect={16 / 9} ... />`.

## Usage Trend

[Usage Trend of react-image-crop](https://npm-compare.com/react-image-crop#timeRange=THREE_YEARS)
  
<a href="https://npm-compare.com/react-image-crop#timeRange=THREE_YEARS" target="_blank">
  <img src="https://npm-compare.com/img/npm-trend/THREE_YEARS/react-image-crop.png" width="100%" alt="NPM Usage Trend of react-image-crop" />
</a>

## Contributing / Developing

To develop run `pnpm install && pnpm dev` and open the localhost server in your browser. Update code and it will reload. When you're ready, open a pull request.
