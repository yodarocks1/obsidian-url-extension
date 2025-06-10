# .url WebView Opener

> A lightweight and minimalist Obsidian plugin to view, open, and edit `.url` files directly in Obsidian’s native webview. Perfect for users who want to keep web documents or webapps accessible inside Obsidian, while standard links still open in your browser. If you simply want all links to open in a webview, use the Webview Core Plugin instead.

---

![demo](assets/screenshot-display.png)

## Installation

### From Obsidian (easiest)

Install the plugin from the [Community plugins](https://obsidian.md/plugins?search=.url%20webview%20opener) section in the app settings.

### From git

Clone the plugin in your `.obsidian/plugins` directory:

```shell
cd /path/to/your/vault/.obsidian/plugins
git clone https://github.com/Kieirra/obsidian-url-extension.git
```

### From source

Download the [latest release](https://github.com/kieirra/obsidian-url-extension/releases) and unzip it in the `.obsidian/plugins/automatic-table-of-contents` directory.

## Usage

### Create URL file

Create a `.url` file with content:
```
https://example.com
```

Or Windows format:
```
[InternetShortcut]
URL=https://example.com
```

### View and Edit

- Click your `.url` file to open it in the Obsidian webview.
- Use the edit button (top right) to modify the URL.
- Use the open in browser button (top right) to launch the link in your default browser.

### Features

Configure in Settings > Community plugins > `.url WebView Opener`:

- **Open in browser by default**: Automatically opens the link in your default browser when you click a `.url` file.
- **Fullscreen mode**: Displays the webview in fullscreen for a more immersive experience, hiding the header bar. You can toggle the header bar back by clicking the chevron icon.

## Publish a new version

- Build the plugin with `npm run build`
- Push a commit with the new version number as message with:
  - The relevant changelog in `README.md`
  - The new version number in `manifest.json`
  - The updated `main.js` (with `npm run build`)
- Tag the commit with the version number
- Publish a [new GitHub release](https://github.com/kieirra/obsidian-url-extension/releases/new) with:
  - The version number as title
  - The changelog from `README.md` as description
  - `main.js`, `styles.css` and `manifest.json` from as attachments
  - _Set as the latest release_ checked

## Changelog

| Version | Date | Notes |
| --- | --- | --- |
| `1.1.0` | 2025-06-10 | Add fullscreen mode and navigation buttons |
| `1.0.0` | 2025-06-10 | Initial version |

## License

This project is released under the [MIT License](LICENSE).

## Contributing

Bug reports and feature requests are welcome!