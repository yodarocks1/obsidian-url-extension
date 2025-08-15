import { Plugin, WorkspaceLeaf, FileView, TFile, PluginSettingTab, App, Setting, normalizePath } from "obsidian";

interface UrlViewerSettings {
    openInBrowser: boolean;
    fullscreenMode: boolean;
}

const DEFAULT_SETTINGS: UrlViewerSettings = {
    openInBrowser: false,
    fullscreenMode: false
}

const VIEW_TYPE_WEB = "url-webview";

// Did not find the right type for webview in obsidian.d.ts
// So i need this to by pass automatic scan for publishing
type WebviewTag = HTMLElement & {
    src: string;
    reload: () => void;
    goBack: () => void;
    goForward: () => void;
    canGoBack: () => Promise<boolean>;
    canGoForward: () => Promise<boolean>;
};

export default class UrlInternalViewerPlugin extends Plugin {
    settings: UrlViewerSettings;

    async onload() {
        await this.loadSettings();
        this.registerView(VIEW_TYPE_WEB, (leaf) => new UrlWebView(leaf, this));
        this.registerExtensions(["url"], VIEW_TYPE_WEB);
        this.addSettingTab(new UrlViewerSettingTab(this.app, this));


        this.addCommand({
            id: "create-url-file",
            name: "Create URL file",
            callback: async () => {
                const fileName = `URL ${Date.now()}.url`;
                const content = `[InternetShortcut]\nURL=\n`;
                const path = normalizePath(fileName);
                const created = await this.app.vault.create(path, content);
                const leaf = this.app.workspace.getLeaf(true);
                await leaf.openFile(created);
                const view = leaf.view;
                if (view instanceof UrlWebView) {
                    view.startEditing();
                }
            },
        });
    }

    async loadSettings() {
        this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());
    }

    async saveSettings() {
        await this.saveData(this.settings);
        this.refreshViews();
    }

    private refreshViews() {
        this.app.workspace.iterateAllLeaves((leaf) => {
            if (leaf.view instanceof UrlWebView) {
                (leaf.view as UrlWebView).updateFullscreenMode();
            }
        });
    }
}

class UrlWebView extends FileView {
    private plugin: UrlInternalViewerPlugin;
    private isEditing: boolean = false;
    private headerHidden: boolean = false;
    private webviewEl: WebviewTag | null = null;
    private backActionEl: HTMLElement | null = null;
    private forwardActionEl: HTMLElement | null = null;

    constructor(leaf: WorkspaceLeaf, plugin: UrlInternalViewerPlugin) {
        super(leaf);
        this.plugin = plugin;
    }

    private get settings() {
        return this.plugin.settings;
    }

    private extractUrl(content: string): string {
        let url = content.trim();
        if (content.includes('[InternetShortcut]')) {
            const match = content.match(/URL=(.+)/);
            if (match) url = match[1].trim();
        }
        return this.normalizeUrl(url);
    }

    getViewType(): string {
        return VIEW_TYPE_WEB;
    }

    getDisplayText(): string {
        return this.file?.basename || "URL Viewer";
    }

    protected async onOpen(): Promise<void> {
        this.containerEl.addClass("url-webview-opener");
        this.updateFullscreenMode();
        this.addAction("edit", "Edit URL", () => this.toggleEditMode());
        this.addAction("external-link", "Open in browser", () => this.openInBrowser());
        this.addAction("refresh-cw", "Reload", () => this.webviewReload());
        this.addAction("arrow-right", "Forward", () => this.webviewGoForward());
        this.addAction("arrow-left", "Back", () => this.webviewGoBack());
    }

    updateFullscreenMode() {
        if (this.settings.fullscreenMode) {
            this.containerEl.addClass("fullscreen-mode");
            this.headerHidden = true;
            this.containerEl.addClass("header-hidden");
        } else {
            this.containerEl.removeClass("fullscreen-mode");
            this.headerHidden = false;
            this.containerEl.removeClass("header-hidden");
        }
    }

    async onLoadFile(file: TFile): Promise<void> {
        const content = await this.app.vault.read(file);
        const url = this.extractUrl(content);
        
        if (this.isEditing) {
            this.showEditMode(file, content);
        } else {
            if (this.settings.openInBrowser) {
                window.open(url, "_blank");
                return;
            }
            this.showViewMode(url);
        }
    }

    private updateActionStates() {
        if (!isWebviewTag(this.webviewEl)) return;
        if (this.backActionEl) {
            this.webviewEl.canGoBack().then((canGoBack: boolean) => {
                if (this.backActionEl) this.backActionEl.toggleClass("is-disabled", !canGoBack);
            });
        }
        if (this.forwardActionEl) {
            this.webviewEl.canGoForward().then((canGoForward: boolean) => {
                if (this.forwardActionEl) this.forwardActionEl.toggleClass("is-disabled", !canGoForward);
            });
        }
    }

    private webviewGoBack() {
        if (isWebviewTag(this.webviewEl)) this.webviewEl.goBack();
    }
    private webviewGoForward() {
        if (isWebviewTag(this.webviewEl)) this.webviewEl.goForward();
    }
    private webviewReload() {
        if (isWebviewTag(this.webviewEl)) this.webviewEl.reload();
    }

    private showViewMode(url: string) {
        const container = this.containerEl.children[1];
        container.empty();

        const webviewEl = document.createElement("webview");
        if (!isWebviewTag(webviewEl)) {
            console.error("webviewEl is not a WebviewTag");
            return;
        }

        webviewEl.src = url;
        webviewEl.setAttribute("style", "width:100%;height:100%;");
        container.appendChild(webviewEl);
        this.webviewEl = webviewEl;

        const actions = this.containerEl.querySelectorAll('.view-action');
        this.backActionEl = actions[0] as HTMLElement;
        this.forwardActionEl = actions[1] as HTMLElement;

        const updateNav = () => this.updateActionStates();
        webviewEl.addEventListener("did-navigate", updateNav);
        webviewEl.addEventListener("did-navigate-in-page", updateNav);
        webviewEl.addEventListener("dom-ready", updateNav);

        if (this.settings.fullscreenMode) {
            const chevron = container.createEl("div", {
                cls: "chevron-toggle",
                text: "⟩"
            });
            chevron.onclick = () => this.toggleHeader();
        }
    }

    private toggleHeader() {
        this.headerHidden = !this.headerHidden;
        if (this.headerHidden) {
            this.containerEl.addClass("header-hidden");
        } else {
            this.containerEl.removeClass("header-hidden");
        }
        const chevron = this.containerEl.querySelector('.chevron-toggle');
        if (chevron) chevron.textContent = "⟩";
    }

    private showEditMode(file: TFile, content: string) {
        const container = this.containerEl.children[1];
        container.empty();

        const editContainer = container.createDiv("url-webview-opener-edit");
        const textarea = editContainer.createEl("textarea", { cls: "url-textarea" });
        textarea.value = content;

        const btnContainer = editContainer.createDiv("url-edit-buttons");
        
        const saveBtn = btnContainer.createEl("button", { text: "Save", cls: "btn-edit" });
        saveBtn.onclick = async () => {
            await this.app.vault.modify(file, textarea.value);
            this.isEditing = false;
            await this.onLoadFile(file);
        };

        const cancelBtn = btnContainer.createEl("button", { text: "Cancel", cls: "btn-edit" });
        cancelBtn.onclick = () => {
            this.isEditing = false;
            this.onLoadFile(file);
        };
    }

    private normalizeUrl(url: string): string {
        const trimmed = url.trim();
        if (!trimmed) return trimmed;
        if (/^[a-zA-Z][a-zA-Z0-9+.+-]*:/.test(trimmed)) return trimmed;
        const withoutSlashes = trimmed.replace(/^\/\//, "");
        return `https://${withoutSlashes}`;
    }

    public startEditing() {
        this.isEditing = true;
        if (this.file) this.onLoadFile(this.file);
    }

    private toggleEditMode() {
        this.isEditing = !this.isEditing;
        if (this.file) this.onLoadFile(this.file);
    }

    private async openInBrowser() {
        if (this.file) {
            const content = await this.app.vault.read(this.file);
            const url = this.extractUrl(content);
            window.open(url, "_blank");
        }
    }
}

class UrlViewerSettingTab extends PluginSettingTab {
    plugin: UrlInternalViewerPlugin;

    constructor(app: App, plugin: UrlInternalViewerPlugin) {
        super(app, plugin);
        this.plugin = plugin;
    }

    display(): void {
        const { containerEl } = this;
        containerEl.empty();
        
        new Setting(containerEl)
            .setName('Open in browser by default')
            .setDesc('Open URL files directly in browser instead of webview')
            .addToggle(toggle => toggle
                .setValue(this.plugin.settings.openInBrowser)
                .onChange(async (value) => {
                    this.plugin.settings.openInBrowser = value;
                    await this.plugin.saveSettings();
                }));

        new Setting(containerEl)
            .setName('Fullscreen mode')
            .setDesc('Hide toolbar and show floating navigation buttons for maximum space')
            .addToggle(toggle => toggle
                .setValue(this.plugin.settings.fullscreenMode)
                .onChange(async (value) => {
                    this.plugin.settings.fullscreenMode = value;
                    await this.plugin.saveSettings();
                }));
    }
}

function isWebviewTag(el: unknown): el is WebviewTag {
    return (
        !!el &&
        typeof (el as WebviewTag).reload === "function" &&
        typeof (el as WebviewTag).goBack === "function" &&
        typeof (el as WebviewTag).goForward === "function"
    );
}
