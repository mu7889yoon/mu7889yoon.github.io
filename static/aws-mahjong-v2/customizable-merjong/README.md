# Merjong

[![npm version](https://img.shields.io/npm/v/merjong)](https://www.npmjs.com/package/merjong)
[![jsDelivr](https://data.jsdelivr.com/v1/package/npm/merjong/badge)](https://www.jsdelivr.com/package/npm/merjong)

## About

Merjong is a JavaScript-based image generation tool that uses MPSZ algebraic notation to create images of mahjong tiles.

## Workspace Layout

- `packages/tile-generator`: SVG牌の生成器（`tile-config.json` と `output/` を管理）
- `packages/merjong-js`: MPSZからSVGをレンダリングするライブラリ

## Example

The following are some examples of Mahjong tile images rendered using Merjong.  

```html
<pre class="merjong">19m19p19s1234567z-q</pre>
<div class="merjong">5'55m-55"5s-555'0''p-X55Xz</div>
```

![img/merjong-sample.png](https://raw.githubusercontent.com/mu7889yoon/customizable-merjong/refs/heads/main/img/merjong-sample.png)

## Merjong MPSZ Notation

- Each tile is represented by a two-character combination of a prefix `[0-9QX]` and a suit `[mpszqx]`. However, `q` and `x` can also be written as a single character.
- The prefix `0` represents a red dora (赤ドラ), which is a red-colored variant of the number 5 tile. For example, `0m` is the red five of characters (manzu), `0p` is the red five of circles (pinzu), and `0s` is the red five of bamboo (souzu).
- The suit `z` corresponds to honor tiles: `1z` = East, `2z` = South, `3z` = West, `4z` = North, `5z` = White Dragon, `6z` = Green Dragon, `7z` = Red Dragon.
- Back tiles (tiles placed face down) can be written in the following formats: `^(x|[0-9]x|X[mpszqx])$` (e.g., `x`, `Xx`, `Xm`, `Xq`).
- Question-mark tiles can be written in the following formats: `^(q|[0-9]q|Q[mpszqx])$` (e.g., `q`, `Qq`, `Qm`, `Qx`).
- When multiple tiles share the same suit and appear consecutively, you can simplify their notation by writing the digits first, followed by a single suit character.  (e.g., `X11Xm`, `123456789s`)
- Adding a single `'` after the prefix displays the tile sideways. (e.g., `3'45m`)  
- Adding `''` after the prefix displays the tile on the second level of a sideways stack. (e.g., `5'0''55s`)  
- Adding `"` after the prefix displays two stacked sideways tiles. (e.g., `33"3p`)
- A space between tiles can be written as a `-`. (e.g., `1'23m-45'6m`)

## Installation

### npm

```sh
npm i merjong 
```

You can then import it in a browser:

```html
<script type="module">
  import merjong from "https://cdn.jsdelivr.net/npm/merjong/+esm"
</script>
```

## Custom Theme

You can use custom SVG images for tiles by passing a theme configuration to the `render()` function.

### Usage

```javascript
import { merjongAPI } from "merjong"

// With custom tile designs
const svg = merjongAPI.render('123m', {
  baseUrl: 'https://example.com/tiles/',
  tileDesigns: {
    '1m': 'Man1-custom.svg',
    '2m': 'Man2-custom.svg'
  }
})

// Or load from your own JSON file
const config = await fetch('/path/to/theme.json').then(r => r.json())
const svg = merjongAPI.render('123m', config)
```

### Config Format

```json
{
  "baseUrl": "https://example.com/tiles/",
  "tileDesigns": {
    "base": "Front.svg",
    "1m": "Man1.svg",
    "2m": "Man2.svg"
  }
}
```

- `baseUrl` (optional): Prepended to relative paths in `tileDesigns`
- `tileDesigns` (optional): Partial override of tile SVG URLs. Unspecified tiles fall back to the default theme.

### Available Tile Keys

| Key | Tile |
|-----|------|
| `base` | Tile background |
| `x` | Back (face down) |
| `q` | Question mark |
| `0m`, `1m`-`9m` | Manzu (Characters) |
| `0p`, `1p`-`9p` | Pinzu (Circles) |
| `0s`, `1s`-`9s` | Souzu (Bamboo) |
| `1z`-`7z` | Honor tiles (East, South, West, North, White, Green, Red) |

## Credits

Mahjong tile images are from [FluffyStuff/riichi-mahjong-tiles](https://github.com/FluffyStuff/riichi-mahjong-tiles), released to the public domain under [CC0 1.0](https://creativecommons.org/publicdomain/zero/1.0/).  
Huge thanks to FluffyStuff!
