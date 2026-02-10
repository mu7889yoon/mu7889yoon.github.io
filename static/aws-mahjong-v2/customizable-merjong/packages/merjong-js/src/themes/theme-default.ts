type TileDesigns = { [key: string]: string }

class Theme {
  tileDesigns: TileDesigns
  isDarkMode: boolean
  backgroundColor: string

  tileWidth: number
  tileHeight: number
  tileGap: number
  spaceWidth: number

  constructor() {
    this.tileDesigns = {
      "base": "https://raw.githubusercontent.com/FluffyStuff/riichi-mahjong-tiles/26e127ba2117f45cdce5ea0225748cc0cfad3169/Regular/Front.svg",
      "q": "https://raw.githubusercontent.com/FluffyStuff/riichi-mahjong-tiles/26e127ba2117f45cdce5ea0225748cc0cfad3169/Regular/Blank.svg",
      "x": "https://raw.githubusercontent.com/FluffyStuff/riichi-mahjong-tiles/26e127ba2117f45cdce5ea0225748cc0cfad3169/Regular/Back.svg",
      "0m": "https://raw.githubusercontent.com/FluffyStuff/riichi-mahjong-tiles/26e127ba2117f45cdce5ea0225748cc0cfad3169/Regular/Man5-Dora.svg",
      "1m": "https://raw.githubusercontent.com/FluffyStuff/riichi-mahjong-tiles/26e127ba2117f45cdce5ea0225748cc0cfad3169/Regular/Man1.svg",
      "2m": "https://raw.githubusercontent.com/FluffyStuff/riichi-mahjong-tiles/26e127ba2117f45cdce5ea0225748cc0cfad3169/Regular/Man2.svg",
      "3m": "https://raw.githubusercontent.com/FluffyStuff/riichi-mahjong-tiles/26e127ba2117f45cdce5ea0225748cc0cfad3169/Regular/Man3.svg",
      "4m": "https://raw.githubusercontent.com/FluffyStuff/riichi-mahjong-tiles/26e127ba2117f45cdce5ea0225748cc0cfad3169/Regular/Man4.svg",
      "5m": "https://raw.githubusercontent.com/FluffyStuff/riichi-mahjong-tiles/26e127ba2117f45cdce5ea0225748cc0cfad3169/Regular/Man5.svg",
      "6m": "https://raw.githubusercontent.com/FluffyStuff/riichi-mahjong-tiles/26e127ba2117f45cdce5ea0225748cc0cfad3169/Regular/Man6.svg",
      "7m": "https://raw.githubusercontent.com/FluffyStuff/riichi-mahjong-tiles/26e127ba2117f45cdce5ea0225748cc0cfad3169/Regular/Man7.svg",
      "8m": "https://raw.githubusercontent.com/FluffyStuff/riichi-mahjong-tiles/26e127ba2117f45cdce5ea0225748cc0cfad3169/Regular/Man8.svg",
      "9m": "https://raw.githubusercontent.com/FluffyStuff/riichi-mahjong-tiles/26e127ba2117f45cdce5ea0225748cc0cfad3169/Regular/Man9.svg",
      "0p": "https://raw.githubusercontent.com/FluffyStuff/riichi-mahjong-tiles/26e127ba2117f45cdce5ea0225748cc0cfad3169/Regular/Pin5-Dora.svg",
      "1p": "https://raw.githubusercontent.com/FluffyStuff/riichi-mahjong-tiles/26e127ba2117f45cdce5ea0225748cc0cfad3169/Regular/Pin1.svg",
      "2p": "https://raw.githubusercontent.com/FluffyStuff/riichi-mahjong-tiles/26e127ba2117f45cdce5ea0225748cc0cfad3169/Regular/Pin2.svg",
      "3p": "https://raw.githubusercontent.com/FluffyStuff/riichi-mahjong-tiles/26e127ba2117f45cdce5ea0225748cc0cfad3169/Regular/Pin3.svg",
      "4p": "https://raw.githubusercontent.com/FluffyStuff/riichi-mahjong-tiles/26e127ba2117f45cdce5ea0225748cc0cfad3169/Regular/Pin4.svg",
      "5p": "https://raw.githubusercontent.com/FluffyStuff/riichi-mahjong-tiles/26e127ba2117f45cdce5ea0225748cc0cfad3169/Regular/Pin5.svg",
      "6p": "https://raw.githubusercontent.com/FluffyStuff/riichi-mahjong-tiles/26e127ba2117f45cdce5ea0225748cc0cfad3169/Regular/Pin6.svg",
      "7p": "https://raw.githubusercontent.com/FluffyStuff/riichi-mahjong-tiles/26e127ba2117f45cdce5ea0225748cc0cfad3169/Regular/Pin7.svg",
      "8p": "https://raw.githubusercontent.com/FluffyStuff/riichi-mahjong-tiles/26e127ba2117f45cdce5ea0225748cc0cfad3169/Regular/Pin8.svg",
      "9p": "https://raw.githubusercontent.com/FluffyStuff/riichi-mahjong-tiles/26e127ba2117f45cdce5ea0225748cc0cfad3169/Regular/Pin9.svg",
      "0s": "https://raw.githubusercontent.com/FluffyStuff/riichi-mahjong-tiles/26e127ba2117f45cdce5ea0225748cc0cfad3169/Regular/Sou5-Dora.svg",
      "1s": "https://raw.githubusercontent.com/FluffyStuff/riichi-mahjong-tiles/26e127ba2117f45cdce5ea0225748cc0cfad3169/Regular/Sou1.svg",
      "2s": "https://raw.githubusercontent.com/FluffyStuff/riichi-mahjong-tiles/26e127ba2117f45cdce5ea0225748cc0cfad3169/Regular/Sou2.svg",
      "3s": "https://raw.githubusercontent.com/FluffyStuff/riichi-mahjong-tiles/26e127ba2117f45cdce5ea0225748cc0cfad3169/Regular/Sou3.svg",
      "4s": "https://raw.githubusercontent.com/FluffyStuff/riichi-mahjong-tiles/26e127ba2117f45cdce5ea0225748cc0cfad3169/Regular/Sou4.svg",
      "5s": "https://raw.githubusercontent.com/FluffyStuff/riichi-mahjong-tiles/26e127ba2117f45cdce5ea0225748cc0cfad3169/Regular/Sou5.svg",
      "6s": "https://raw.githubusercontent.com/FluffyStuff/riichi-mahjong-tiles/26e127ba2117f45cdce5ea0225748cc0cfad3169/Regular/Sou6.svg",
      "7s": "https://raw.githubusercontent.com/FluffyStuff/riichi-mahjong-tiles/26e127ba2117f45cdce5ea0225748cc0cfad3169/Regular/Sou7.svg",
      "8s": "https://raw.githubusercontent.com/FluffyStuff/riichi-mahjong-tiles/26e127ba2117f45cdce5ea0225748cc0cfad3169/Regular/Sou8.svg",
      "9s": "https://raw.githubusercontent.com/FluffyStuff/riichi-mahjong-tiles/26e127ba2117f45cdce5ea0225748cc0cfad3169/Regular/Sou9.svg",
      "1z": "https://raw.githubusercontent.com/FluffyStuff/riichi-mahjong-tiles/26e127ba2117f45cdce5ea0225748cc0cfad3169/Regular/Ton.svg",
      "2z": "https://raw.githubusercontent.com/FluffyStuff/riichi-mahjong-tiles/26e127ba2117f45cdce5ea0225748cc0cfad3169/Regular/Nan.svg",
      "3z": "https://raw.githubusercontent.com/FluffyStuff/riichi-mahjong-tiles/26e127ba2117f45cdce5ea0225748cc0cfad3169/Regular/Shaa.svg",
      "4z": "https://raw.githubusercontent.com/FluffyStuff/riichi-mahjong-tiles/26e127ba2117f45cdce5ea0225748cc0cfad3169/Regular/Pei.svg",
      "5z": "https://raw.githubusercontent.com/FluffyStuff/riichi-mahjong-tiles/26e127ba2117f45cdce5ea0225748cc0cfad3169/Regular/Haku.svg",
      "6z": "https://raw.githubusercontent.com/FluffyStuff/riichi-mahjong-tiles/26e127ba2117f45cdce5ea0225748cc0cfad3169/Regular/Hatsu.svg",
      "7z": "https://raw.githubusercontent.com/FluffyStuff/riichi-mahjong-tiles/26e127ba2117f45cdce5ea0225748cc0cfad3169/Regular/Chun.svg"
    }
    this.backgroundColor = "green"
    this.isDarkMode = false

    this.tileWidth = 36
    this.tileHeight = 48
    this.tileGap = 3
    this.spaceWidth = 10
  }
}

export const getThemeVariables = () => {
  return new Theme()
}