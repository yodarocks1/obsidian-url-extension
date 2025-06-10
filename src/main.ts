import { Plugin, WorkspaceLeaf, FileView, TFile, PluginSettingTab, App, Setting } from "obsidian";

interface UrlViewerSettings {
    openInBrowser: boolean;
}

const DEFAULT_SETTINGS: UrlViewerSettings = {
    openInBrowser: false
}

const VIEW_TYPE_WEB = "url-webview";

export default class UrlInternalViewerPlugin extends Plugin {
    settings: UrlViewerSettings;

    async onload() {
        await this.loadSettings();
        this.registerView(VIEW_TYPE_WEB, (leaf) => new UrlWebView(leaf, this.settings));
        this.registerExtensions(["url"], VIEW_TYPE_WEB);
        this.addSettingTab(new UrlViewerSettingTab(this.app, this));
    }

    onunload() {
        this.app.workspace.detachLeavesOfType(VIEW_TYPE_WEB);
    }

    async loadSettings() {
        this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());
    }

    async saveSettings() {
        await this.saveData(this.settings);
    }
}

class UrlWebView extends FileView {
    private settings: UrlViewerSettings;
    private isEditing: boolean = false;

    constructor(leaf: WorkspaceLeaf, settings: UrlViewerSettings) {
        super(leaf);
        this.settings = settings;
    }

    private extractUrl(content: string): string {
        let url = content.trim();
        if (content.includes('[InternetShortcut]')) {
            const match = content.match(/URL=(.+)/);
            if (match) url = match[1].trim();
        }
        return url;
    }

    getViewType(): string {
        return VIEW_TYPE_WEB;
    }

    getDisplayText(): string {
        return this.file?.basename || "URL Viewer";
    }

    protected async onOpen(): Promise<void> {
        this.containerEl.addClass("url-viewer-container");       
        this.addAction("edit", "Edit URL", () => this.toggleEditMode());
        this.addAction("external-link", "Open in browser", () => this.openInBrowser());
    }

    async onLoadFile(file: TFile): Promise<void> {
        const content = await this.app.vault.read(file);
        
        if (this.settings.openInBrowser) {
            const url = this.extractUrl(content);
            window.open(url, "_blank");
            return;
        }

        if (this.isEditing) {
            this.showEditMode(file, content);
        } else {
            const url = this.extractUrl(content);
            this.showViewMode(url);
        }
    }

    private showViewMode(url: string) {
        const container = this.containerEl.children[1];
        container.empty();

        const iframe = container.createEl("iframe");
        iframe.src = url;
        iframe.style.width = "100%";
        iframe.style.height = "100%";
        iframe.style.border = "none";
        iframe.style.margin = "0";
        iframe.style.padding = "0";
        iframe.style.overflow = "hidden";
        iframe.setAttribute("sandbox", "allow-same-origin allow-scripts allow-forms allow-popups");
        iframe.setAttribute("scrolling", "yes");
    }

    private showEditMode(file: TFile, content: string) {
        const container = this.containerEl.children[1];
        container.empty();

        const editContainer = container.createDiv("url-edit-container");
        const textarea = editContainer.createEl("textarea", { cls: "url-textarea" });
        textarea.value = content;

        const btnContainer = editContainer.createDiv("url-edit-buttons");
        
        const saveBtn = btnContainer.createEl("button", { text: "Save", cls: "url-btn" });
        saveBtn.onclick = async () => {
            await this.app.vault.modify(file, textarea.value);
            this.isEditing = false;
            await this.onLoadFile(file);
        };

        const cancelBtn = btnContainer.createEl("button", { text: "Cancel", cls: "url-btn" });
        cancelBtn.onclick = () => {
            this.isEditing = false;
            this.onLoadFile(file);
        };
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
        
        containerEl.createEl('h2', { text: 'URL Viewer Settings' });

        new Setting(containerEl)
            .setName('Open in browser by default')
            .setDesc('Open URL files directly in browser instead of webview')
            .addToggle(toggle => toggle
                .setValue(this.plugin.settings.openInBrowser)
                .onChange(async (value) => {
                    this.plugin.settings.openInBrowser = value;
                    await this.plugin.saveSettings();
                }));
    }
}
