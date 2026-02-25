// ==UserScript==
// @name         AI Web Page Assistant
// @namespace    http://tampermonkey.net/
// @version      1.0
// @description  AI-powered summarization and conversation assistant for web pages.
// @author       You
// @match        *://*/*
// @grant        GM_setValue
// @grant        GM_getValue
// @grant        GM_addStyle
// @grant        GM_xmlhttpRequest
// @require      https://cdn.jsdelivr.net/npm/@mozilla/readability@0.5.0/Readability.js
// @require      https://cdn.jsdelivr.net/npm/marked/marked.min.js
// @require      https://cdn.jsdelivr.net/npm/dompurify@3.1.5/dist/purify.min.js
// ==/UserScript==

(function () {
    'use strict';

    // ==========================================
    // Core Data Management
    // ==========================================
    const DEFAULT_CONFIG = {
        apiEndpoint: 'https://api.openai.com/v1',
        apiKey: '',
        modelId: 'gpt-3.5-turbo',
        followUpModelId: 'gpt-3.5-turbo',
        assistants: [
            { id: '1', name: '📝 通用总结', systemPrompt: '你是一个专业的网页内容总结助手。', userPrompt: '请总结以下内容的主要观点：\n{{ content }}' },
            { id: '2', name: '💻 技术文档', systemPrompt: '你是一个资深的程序员和技术文档分析师。', userPrompt: '请提取这篇技术文档的核心要点、API 用法或代码关键信息：\n{{ content }}' },
            { id: '3', name: '📰 新闻文章', systemPrompt: '你是一个敏锐的新闻编辑和信息提取专家。', userPrompt: '请帮我概括这篇新闻的事件起因、经过、结果以及核心观点：\n{{ content }}' },
            { id: '4', name: '📚 教程指南', systemPrompt: '你是一个耐心、擅长提炼核心步骤的导师。', userPrompt: '请把这篇教程的核心步骤、注意事项提炼出来，让我能快速跟做：\n{{ content }}' },
            { id: '5', name: '🔬 学术论文', systemPrompt: '你是一个专业的学术研究员，擅长总结论文核心机制和数据。', userPrompt: '请总结这篇论文的研究背景、核心方法、实验结果和主要贡献：\n{{ content }}' },
            { id: '6', name: '🎁 产品介绍', systemPrompt: '你是一个专业的产品经理和市场分析师。', userPrompt: '请分析这个产品的主要功能、卖点、目标受众和相对优势：\n{{ content }}' }
        ],
        activeAssistantId: '1',
        streamResponses: true
    };

    function getConfig() {
        return GM_getValue('ai_assistant_config', DEFAULT_CONFIG);
    }

    function saveConfig(config) {
        GM_setValue('ai_assistant_config', config);
    }

    // ==========================================
    // UI Elements Injection & Styling
    // ==========================================

    // Inject Custom Tailwind-like CSS for isolated styling
    const CSS_STYLES = `
        #ai-assistant-root {
            font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
            font-size: 14px;
            color: #333;
            z-index: 999999;
            position: fixed;
            pointer-events: none; /* Let clicks pass through the container itself */
            top: 0; left: 0; width: 100vw; height: 100vh;
        }
        
        #ai-assistant-root * {
            box-sizing: border-box;
            pointer-events: auto; /* Re-enable clicks for actual UI elements */
        }

        /* Floating Button */
        #ai-fab {
            position: fixed;
            bottom: 20px;
            right: 20px;
            width: 50px;
            height: 50px;
            border-radius: 25px;
            background-color: #007bff;
            color: white;
            display: flex;
            align-items: center;
            justify-content: center;
            box-shadow: 0 4px 12px rgba(0,0,0,0.15);
            cursor: move; /* Indicate draggable */
            user-select: none;
            transition: transform 0.2s, background-color 0.2s;
        }

        #ai-fab:hover, #ai-fab:active {
            transform: scale(1.05);
            background-color: #0056b3;
            opacity: 1 !important;
            right: 20px !important;
        }
        
        #ai-fab.auto-hide {
            opacity: 0.3;
            right: -25px !important; /* Slide partially off screen */
        }
        
        #ai-fab svg {
            width: 24px;
            height: 24px;
            fill: currentColor;
        }

        /* Main Panel - Default (Desktop: Right Side) */
        #ai-panel {
            position: fixed;
            top: 20px;
            right: 20px;
            bottom: 20px;
            width: 400px;
            background: white;
            border-radius: 12px;
            box-shadow: 0 8px 30px rgba(0,0,0,0.12);
            display: flex;
            flex-direction: column;
            transform: translateX(120%);
            transition: transform 0.3s cubic-bezier(0.4, 0, 0.2, 1);
            overflow: hidden;
            border: 1px solid #e2e8f0;
        }

        #ai-panel.open {
            transform: translateX(0);
        }

        /* Mobile Responsive (Bottom Half) */
        @media (max-width: 768px) {
            #ai-panel {
                top: auto;
                right: 0;
                bottom: 0;
                width: 100vw;
                height: 60vh;
                border-radius: 20px 20px 0 0;
                transform: translateY(100%);
                border-left: none;
                border-right: none;
                border-bottom: none;
            }
            #ai-panel.open {
                transform: translateY(0);
            }
        }

        /* Header */
        #ai-header {
            padding: 12px 16px;
            background: #f8fafc;
            border-bottom: 1px solid #e2e8f0;
            display: flex;
            align-items: center;
            justify-content: space-between;
            font-weight: 600;
            color: #1e293b;
            border-radius: 12px 12px 0 0;
        }
        
        .ai-header-actions {
            display: flex;
            gap: 8px;
        }

        .ai-icon-btn {
            background: none;
            border: none;
            cursor: pointer;
            padding: 4px;
            border-radius: 4px;
            color: #64748b;
            transition: background 0.2s, color 0.2s;
            display: flex;
            align-items: center;
            justify-content: center;
        }

        .ai-icon-btn:hover {
            background: #e2e8f0;
            color: #0f172a;
        }

        /* Content Area (Chat/Settings) */
        #ai-content {
            flex: 1;
            overflow-y: auto;
            position: relative;
            background: #ffffff;
            display: flex;
            flex-direction: column;
        }

        /* --- Settings View --- */
        #ai-settings-view {
            padding: 16px;
            display: none; /* Hidden by default */
            flex-direction: column;
            gap: 16px;
        }

        .ai-form-group {
            display: flex;
            flex-direction: column;
            gap: 6px;
        }

        .ai-form-group label {
            font-size: 13px;
            font-weight: 500;
            color: #475569;
        }

        .ai-input, .ai-select {
            padding: 8px 12px;
            border: 1px solid #cbd5e1;
            border-radius: 6px;
            font-size: 14px;
            outline: none;
            transition: border-color 0.2s;
        }

        .ai-input:focus, .ai-select:focus {
            border-color: #3b82f6;
            box-shadow: 0 0 0 2px rgba(59, 130, 246, 0.1);
        }

        .ai-btn {
            padding: 8px 16px;
            background: #3b82f6;
            color: white;
            border: none;
            border-radius: 6px;
            font-weight: 500;
            cursor: pointer;
            transition: background 0.2s;
            text-align: center;
        }

        .ai-btn:hover {
            background: #2563eb;
        }
        
        .ai-btn-secondary {
            background: #f1f5f9;
            color: #334155;
            border: 1px solid #cbd5e1;
        }
        .ai-btn-secondary:hover {
             background: #e2e8f0;
        }

        /* --- Chat View --- */
        #ai-chat-view {
            display: flex;
            flex-direction: column;
            height: 100%;
        }

        #ai-chat-messages {
            flex: 1;
            padding: 16px;
            overflow-y: auto;
            display: flex;
            flex-direction: column;
            gap: 12px;
        }

        .ai-message {
            max-width: 85%;
            padding: 10px 14px;
            border-radius: 12px;
            line-height: 1.5;
            word-wrap: break-word;
        }

        .ai-message p { margin: 0 0 8px 0; }
        .ai-message p:last-child { margin: 0; }
        
        /* Markdown Styles */
        .ai-message pre { background: #1e293b; color: #f8fafc; padding: 12px; border-radius: 6px; overflow-x: auto; font-family: monospace; font-size: 13px; margin: 8px 0;}
        .ai-message code { background: rgba(0,0,0,0.05); padding: 2px 4px; border-radius: 4px; font-family: monospace; font-size: 13px;}
        .ai-message pre code { background: transparent; padding: 0; }
        .ai-message ul, .ai-message ol { margin: 8px 0; padding-left: 20px; }
        .ai-message blockquote { border-left: 3px solid #cbd5e1; margin: 8px 0; padding-left: 12px; color: #64748b; }

        .ai-msg-user {
            align-self: flex-end;
            background: #3b82f6;
            color: white;
            border-bottom-right-radius: 2px;
        }
        .ai-msg-user code { background: rgba(255,255,255,0.2); }

        .ai-msg-assistant {
            align-self: flex-start;
            background: #f1f5f9;
            color: #1e293b;
            border-bottom-left-radius: 2px;
        }

        #ai-chat-input-area {
            padding: 12px;
            border-top: 1px solid #e2e8f0;
            background: white;
            display: flex;
            gap: 8px;
        }

        #ai-chat-textarea {
            flex: 1;
            resize: none;
            padding: 10px 12px;
            border: 1px solid #cbd5e1;
            border-radius: 8px;
            outline: none;
            font-family: inherit;
            font-size: 14px;
            max-height: 120px;
            min-height: 42px;
        }

        #ai-chat-send {
            background: #3b82f6;
            color: white;
            border: none;
            border-radius: 8px;
            width: 42px;
            height: 42px;
            display: flex;
            align-items: center;
            justify-content: center;
            cursor: pointer;
            transition: background 0.2s;
        }
        
        #ai-chat-send:disabled {
            background: #94a3b8;
            cursor: not-allowed;
        }

        #ai-chat-send:hover:not(:disabled) {
            background: #2563eb;
        }
        
        /* Auto Follow-up Suggestions */
        #ai-follow-ups {
            display: flex;
            flex-wrap: wrap;
            gap: 8px;
            padding: 0 16px 12px 16px;
        }
        
        .ai-follow-up-chip {
            background: #e0f2fe;
            color: #0369a1;
            border: 1px solid #bae6fd;
            padding: 6px 12px;
            border-radius: 16px;
            font-size: 12px;
            cursor: pointer;
            transition: all 0.2s;
            white-space: nowrap;
            overflow: hidden;
            text-overflow: ellipsis;
            max-width: 100%;
        }
        
        .ai-follow-up-chip:hover {
            background: #bae6fd;
        }
    `;

    // SVG Icons
    const ICONS = {
        robot: '<svg viewBox="0 0 24 24"><path d="M12 2a2 2 0 0 1 2 2c0 .74-.4 1.39-1 1.73V7h1a7 7 0 0 1 7 7h1a1 1 0 0 1 1 1v3a1 1 0 0 1-1 1h-1v1a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-1H2a1 1 0 0 1-1-1v-3a1 1 0 0 1 1-1h1a7 7 0 0 1 7-7h1V5.73A2 2 0 1 1 12 2zm-3 10a2 2 0 1 0 0 4 2 2 0 0 0 0-4zm6 0a2 2 0 1 0 0 4 2 2 0 0 0 0-4z"/></svg>',
        close: '<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>',
        settings: '<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="3"></circle><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"></path></svg>',
        send: '<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="22" y1="2" x2="11" y2="13"></line><polygon points="22 2 15 22 11 13 2 9 22 2"></polygon></svg>',
        back: '<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="19" y1="12" x2="5" y2="12"></line><polyline points="12 19 5 12 12 5"></polyline></svg>'
    };

    // Current State
    let isPanelOpen = false;
    let isSettingsOpen = false;
    let currentConfig = getConfig();
    let chatHistory = [];
    let isWaitingForResponse = false;
    let pageContentCache = null;
    let fabHideTimeout = null;

    // DOM Elements Map
    const DOM = {};

    function init() {
        GM_addStyle(CSS_STYLES);

        const root = document.createElement('div');
        root.id = 'ai-assistant-root';

        root.innerHTML = `
            <div id="ai-fab" title="AI Assistant (Cmd/Ctrl + J)">
                ${ICONS.robot}
            </div>
            <div id="ai-panel">
                <div id="ai-header">
                    <span id="ai-title">AI 网页总结助手</span>
                    <div class="ai-header-actions">
                        <button id="ai-btn-back" class="ai-icon-btn" style="display:none;" title="返回聊天">
                            ${ICONS.back}
                        </button>
                        <button id="ai-btn-settings" class="ai-icon-btn" title="设置">
                            ${ICONS.settings}
                        </button>
                        <button id="ai-btn-close" class="ai-icon-btn" title="最小化 (Cmd/Ctrl + J)">
                            ${ICONS.close}
                        </button>
                    </div>
                </div>
                
                <div id="ai-content">
                    <!-- Chat View -->
                    <div id="ai-chat-view">
                        <div id="ai-chat-messages">
                            <div class="ai-message ai-msg-assistant">
                                您好！我已准备好阅读此页面。点击下方按钮开始总结，或直接问我问题。
                            </div>
                        </div>
                        <div id="ai-follow-ups"></div>
                        <div id="ai-chat-input-area">
                            <div style="display:flex; flex-direction:column; gap:8px; flex:1;">
                                <div style="display:flex; gap:8px; align-items:center;">
                                    <select id="ai-assistant-select" class="ai-select" style="max-width: 120px; padding: 6px; font-size:12px; height:32px;"></select>
                                    <button id="ai-btn-summarize" class="ai-btn ai-btn-secondary" style="padding: 0 12px; height:32px; font-size: 12px; white-space: nowrap;" title="一键总结网页正文">✨ 一键总结</button>
                                </div>
                                <div style="display:flex; gap:8px; align-items:flex-end;">
                                    <textarea id="ai-chat-textarea" placeholder="输入你想问的问题..." rows="1"></textarea>
                                    <button id="ai-chat-send">${ICONS.send}</button>
                                </div>
                            </div>
                        </div>
                    </div>
                    
                    <!-- Settings View -->
                    <div id="ai-settings-view">
                        <div class="ai-form-group">
                            <label>API Base URL</label>
                            <input type="text" id="ai-set-api-url" class="ai-input" placeholder="https://api.openai.com/v1">
                        </div>
                        <div class="ai-form-group">
                            <label>API Key</label>
                            <input type="password" id="ai-set-api-key" class="ai-input" placeholder="sk-...">
                        </div>
                        <div class="ai-form-group">
                            <label>主要对话模型 Model ID</label>
                            <div style="display:flex; gap: 8px;">
                                <select id="ai-set-model-id" class="ai-select" style="flex:1;">
                                    <option value="gpt-3.5-turbo">gpt-3.5-turbo</option>
                                    <option value="gpt-4o">gpt-4o</option>
                                    <option value="gpt-4o-mini">gpt-4o-mini</option>
                                </select>
                                <button id="ai-set-fetch-models" class="ai-btn ai-btn-secondary" style="white-space:nowrap;">获取列表</button>
                            </div>
                        </div>
                        <div class="ai-form-group">
                            <label>追问生成模型 Model ID (可选不同模型降低成本)</label>
                            <select id="ai-set-followup-model-id" class="ai-select">
                            </select>
                        </div>
                        <div class="ai-form-group" style="flex-direction: row; align-items: center; justify-content: space-between;">
                            <label for="ai-set-stream" style="cursor: pointer;">开启流式输出 (打字机效果)</label>
                            <input type="checkbox" id="ai-set-stream" style="width:16px; height:16px; cursor:pointer;" checked>
                        </div>
                        <div class="ai-form-group" style="margin-top: 10px; border-top: 1px solid #e2e8f0; padding-top: 16px;">
                            <label>定制对话助手 / 提示词</label>
                            <div style="display:flex; gap: 8px; margin-bottom: 4px;">
                                <select id="ai-set-ast-select" class="ai-select" style="flex:1;"></select>
                                <button id="ai-set-ast-add" class="ai-btn ai-btn-secondary" title="新建助手">新建</button>
                                <button id="ai-set-ast-del" class="ai-btn" style="background:#ef4444; color:white; border:none;" title="删除当前助手">删除</button>
                            </div>
                            <input type="text" id="ai-set-ast-name" class="ai-input" placeholder="助手名称">
                            <label style="font-size: 12px; margin-top: 4px; color: #64748b;">System Prompt</label>
                            <textarea id="ai-set-ast-sys" class="ai-input" rows="2" placeholder="你是一个..."></textarea>
                            <label style="font-size: 12px; margin-top: 4px; color: #64748b;">User Prompt (使用 {{ content }} 代表网页正文)</label>
                            <textarea id="ai-set-ast-user" class="ai-input" rows="3" placeholder="总结: {{ content }}"></textarea>
                        </div>
                        <div class="ai-form-group" style="margin-top: 10px; border-top: 1px solid #e2e8f0; padding-top: 16px;">
                            <label>数据管理</label>
                            <div style="display:flex; gap: 8px;">
                                <button id="ai-set-export" class="ai-btn ai-btn-secondary" style="flex:1;">导出配置</button>
                                <button id="ai-set-import" class="ai-btn ai-btn-secondary" style="flex:1;">导入配置</button>
                                <input type="file" id="ai-set-import-file" accept=".json" style="display:none;">
                            </div>
                        </div>
                        <button id="ai-set-save" class="ai-btn" style="margin-top: auto;">保存设置</button>
                    </div>
                </div>
            </div>
        `;

        document.body.appendChild(root);

        // Cache DOM
        DOM.fab = document.getElementById('ai-fab');
        DOM.panel = document.getElementById('ai-panel');
        DOM.btnSettings = document.getElementById('ai-btn-settings');
        DOM.btnClose = document.getElementById('ai-btn-close');
        DOM.btnBack = document.getElementById('ai-btn-back');
        DOM.title = document.getElementById('ai-title');

        DOM.chatView = document.getElementById('ai-chat-view');
        DOM.settingsView = document.getElementById('ai-settings-view');

        DOM.chatMessages = document.getElementById('ai-chat-messages');
        DOM.chatTextarea = document.getElementById('ai-chat-textarea');
        DOM.chatSend = document.getElementById('ai-chat-send');
        DOM.assistantSelect = document.getElementById('ai-assistant-select');
        DOM.btnSummarize = document.getElementById('ai-btn-summarize');
        DOM.followUps = document.getElementById('ai-follow-ups');

        // Settings Inputs
        DOM.setApiUrl = document.getElementById('ai-set-api-url');
        DOM.setApiKey = document.getElementById('ai-set-api-key');
        DOM.setModelId = document.getElementById('ai-set-model-id');
        DOM.setFollowupModelId = document.getElementById('ai-set-followup-model-id');
        DOM.btnFetchModels = document.getElementById('ai-set-fetch-models');
        DOM.btnSaveSettings = document.getElementById('ai-set-save');
        DOM.btnExport = document.getElementById('ai-set-export');
        DOM.btnImport = document.getElementById('ai-set-import');
        DOM.fileImport = document.getElementById('ai-set-import-file');

        // Assistant Settings Inputs
        DOM.setAstSelect = document.getElementById('ai-set-ast-select');
        DOM.setAstAdd = document.getElementById('ai-set-ast-add');
        DOM.setAstDel = document.getElementById('ai-set-ast-del');
        DOM.setAstName = document.getElementById('ai-set-ast-name');
        DOM.setAstSys = document.getElementById('ai-set-ast-sys');
        DOM.setAstUser = document.getElementById('ai-set-ast-user');
        DOM.setStream = document.getElementById('ai-set-stream');

        bindEvents();
        populateSettings();
        populateAssistants();
        makeDraggable(DOM.fab);
    }

    // ==========================================
    // Interaction & UI Logic
    // ==========================================
    function bindEvents() {
        // Toggle Panel
        DOM.fab.addEventListener('click', togglePanel);
        DOM.btnClose.addEventListener('click', () => togglePanel(false));

        // Keyboard Shortcut CMD/CTRL + J
        document.addEventListener('keydown', (e) => {
            if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'j') {
                e.preventDefault();
                togglePanel();
            }
        });

        // Toggle Settings
        DOM.btnSettings.addEventListener('click', () => switchView('settings'));
        DOM.btnBack.addEventListener('click', () => switchView('chat'));

        // Settings Actions
        DOM.btnSaveSettings.addEventListener('click', saveSettingsFromUI);
        DOM.btnFetchModels.addEventListener('click', fetchModelsFromAPI);
        DOM.btnExport.addEventListener('click', exportConfig);
        DOM.btnImport.addEventListener('click', () => DOM.fileImport.click());
        DOM.fileImport.addEventListener('change', importConfig);

        // Assistant Settings Actions
        DOM.setAstSelect.addEventListener('change', loadSelectedAssistantToForm);
        DOM.setAstAdd.addEventListener('click', addNewAssistant);
        DOM.setAstDel.addEventListener('click', deleteCurrentAssistant);

        // Live update assistant object on input
        const astInputs = [DOM.setAstName, DOM.setAstSys, DOM.setAstUser];
        astInputs.forEach(input => {
            input.addEventListener('input', () => {
                const id = DOM.setAstSelect.value;
                const ast = currentConfig.assistants.find(a => a.id === id);
                if (ast) {
                    ast.name = DOM.setAstName.value;
                    ast.systemPrompt = DOM.setAstSys.value;
                    ast.userPrompt = DOM.setAstUser.value;
                    // Update option text
                    DOM.setAstSelect.options[DOM.setAstSelect.selectedIndex].text = ast.name;
                }
            });
        });

        // Chat Actions
        DOM.btnSummarize.addEventListener('click', handleSummarizeClick);
        DOM.chatSend.addEventListener('click', handleSendChat);
        DOM.chatTextarea.addEventListener('keydown', (e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                handleSendChat();
            }
        });

        // Auto-resize textarea
        DOM.chatTextarea.addEventListener('input', function () {
            this.style.height = 'auto';
            this.style.height = (this.scrollHeight) + 'px';
        });
    }

    function togglePanel(forceState) {
        isPanelOpen = typeof forceState === 'boolean' ? forceState : !isPanelOpen;
        if (isPanelOpen) {
            DOM.panel.classList.add('open');
            DOM.fab.style.display = 'none';
            resetFabAutoHide(); // clear the timeout so it doesn't hide when closed
            if (!isSettingsOpen) {
                setTimeout(() => DOM.chatTextarea.focus(), 300);
            }
        } else {
            DOM.panel.classList.remove('open');
            setTimeout(() => {
                DOM.fab.style.display = 'flex';
                startFabAutoHide(); // Restart hide timer when closed
            }, 300);
        }
    }

    function switchView(view) {
        isSettingsOpen = view === 'settings';
        if (isSettingsOpen) {
            DOM.chatView.style.display = 'none';
            DOM.settingsView.style.display = 'flex';
            DOM.btnSettings.style.display = 'none';
            DOM.btnBack.style.display = 'flex';
            DOM.title.textContent = '设置';
            populateSettings(); // Refresh before showing
        } else {
            DOM.settingsView.style.display = 'none';
            DOM.chatView.style.display = 'flex';
            DOM.btnBack.style.display = 'none';
            DOM.btnSettings.style.display = 'flex';
            DOM.title.textContent = 'AI 网页总结助手';
        }
    }

    function switchView(view) {
        isSettingsOpen = view === 'settings';
        if (isSettingsOpen) {
            DOM.chatView.style.display = 'none';
            DOM.settingsView.style.display = 'flex';
            DOM.btnSettings.style.display = 'none';
            DOM.btnBack.style.display = 'flex';
            DOM.title.textContent = '设置';
            populateSettings(); // Refresh before showing
        } else {
            DOM.settingsView.style.display = 'none';
            DOM.chatView.style.display = 'flex';
            DOM.btnBack.style.display = 'none';
            DOM.btnSettings.style.display = 'flex';
            DOM.title.textContent = 'AI 网页总结助手';
        }
    }

    // Auto-hide FAB Logic
    function resetFabAutoHide() {
        DOM.fab.classList.remove('auto-hide');
        clearTimeout(fabHideTimeout);
    }

    function startFabAutoHide() {
        clearTimeout(fabHideTimeout);
        if (!isPanelOpen) {
            fabHideTimeout = setTimeout(() => {
                if (!isPanelOpen && !DOM.fab.matches(':hover')) {
                    DOM.fab.classList.add('auto-hide');
                }
            }, 3000);
        }
    }

    // Draggable FAB Logic
    function makeDraggable(el) {
        let isDragging = false;
        let startX, startY, initialX, initialY;

        // localized hover listeners for auto-hide
        el.addEventListener('mouseenter', resetFabAutoHide);
        el.addEventListener('mouseleave', startFabAutoHide);
        el.addEventListener('touchstart', resetFabAutoHide, { passive: true });
        el.addEventListener('touchend', startFabAutoHide, { passive: true });

        // Initial auto-hide start
        startFabAutoHide();

        el.addEventListener('mousedown', dragStart);
        el.addEventListener('touchstart', dragStart, { passive: false });

        function dragStart(e) {
            if (e.type === "touchstart") {
                startX = e.touches[0].clientX;
                startY = e.touches[0].clientY;
            } else {
                startX = e.clientX;
                startY = e.clientY;
            }

            const rect = el.getBoundingClientRect();
            // Store current bottom/right computed relative to window
            initialX = window.innerWidth - rect.right;
            initialY = window.innerHeight - rect.bottom;

            document.addEventListener('mousemove', drag);
            document.addEventListener('touchmove', drag, { passive: false });
            document.addEventListener('mouseup', dragEnd);
            document.addEventListener('touchend', dragEnd);
        }

        function drag(e) {
            isDragging = true;
            e.preventDefault();
            let currentX, currentY;

            if (e.type === "touchmove") {
                currentX = e.touches[0].clientX;
                currentY = e.touches[0].clientY;
            } else {
                currentX = e.clientX;
                currentY = e.clientY;
            }

            const dx = startX - currentX;
            const dy = startY - currentY;

            const newRight = Math.max(0, Math.min(window.innerWidth - el.offsetWidth, initialX + dx));
            const newBottom = Math.max(0, Math.min(window.innerHeight - el.offsetHeight, initialY + dy));

            el.style.right = `${newRight}px`;
            el.style.bottom = `${newBottom}px`;
        }

        function dragEnd() {
            document.removeEventListener('mousemove', drag);
            document.removeEventListener('touchmove', drag);
            document.removeEventListener('mouseup', dragEnd);
            document.removeEventListener('touchend', dragEnd);

            // Allow click to register if it wasn't a drag
            setTimeout(() => { isDragging = false; }, 50);
        }

        // Prevent click if we were dragging
        el.addEventListener('click', (e) => {
            if (isDragging) {
                e.preventDefault();
                e.stopImmediatePropagation();
            }
        }, true);
    }

    // ==========================================
    // Settings & Models Management
    // ==========================================
    function populateSettings() {
        DOM.setApiUrl.value = currentConfig.apiEndpoint || DEFAULT_CONFIG.apiEndpoint;
        DOM.setApiKey.value = currentConfig.apiKey || '';
        DOM.setStream.checked = currentConfig.streamResponses !== false;

        // Populate standard models as fallback if empty
        if (DOM.setModelId.options.length <= 3) {
            updateModelSelects([currentConfig.modelId, 'gpt-3.5-turbo', 'gpt-4o', 'gpt-4o-mini', 'claude-3-haiku-20240307']);
        }

        DOM.setModelId.value = currentConfig.modelId || 'gpt-3.5-turbo';
        DOM.setFollowupModelId.value = currentConfig.followUpModelId || 'gpt-3.5-turbo';
    }

    function populateAssistants() {
        DOM.assistantSelect.innerHTML = '';
        DOM.setAstSelect.innerHTML = ''; // Also populate settings select

        currentConfig.assistants.forEach(ast => {
            const opt1 = document.createElement('option');
            opt1.value = ast.id;
            opt1.textContent = ast.name;
            DOM.assistantSelect.appendChild(opt1);

            const opt2 = document.createElement('option');
            opt2.value = ast.id;
            opt2.textContent = ast.name;
            DOM.setAstSelect.appendChild(opt2);
        });

        const activeId = currentConfig.activeAssistantId || currentConfig.assistants[0].id;
        DOM.assistantSelect.value = activeId;
        DOM.setAstSelect.value = activeId;

        loadSelectedAssistantToForm();
    }

    function loadSelectedAssistantToForm() {
        const id = DOM.setAstSelect.value;
        const ast = currentConfig.assistants.find(a => a.id === id) || currentConfig.assistants[0];
        if (ast) {
            DOM.setAstName.value = ast.name || '';
            DOM.setAstSys.value = ast.systemPrompt || '';
            DOM.setAstUser.value = ast.userPrompt || '';
        }
    }

    function addNewAssistant() {
        const newId = Date.now().toString();
        const newAst = {
            id: newId,
            name: '新助手 ' + (currentConfig.assistants.length + 1),
            systemPrompt: '你是一个专业的网页内容总结助手。',
            userPrompt: '请总结以下内容的主要观点：\n{{ content }}'
        };
        currentConfig.assistants.push(newAst);
        DOM.setAstSelect.appendChild(new Option(newAst.name, newId));
        DOM.setAstSelect.value = newId;
        loadSelectedAssistantToForm();
    }

    function deleteCurrentAssistant() {
        if (currentConfig.assistants.length <= 1) {
            alert("必须至少保留一个助手！");
            return;
        }
        const id = DOM.setAstSelect.value;
        if (confirm("确定要删除此助手吗？")) {
            currentConfig.assistants = currentConfig.assistants.filter(a => a.id !== id);

            if (currentConfig.activeAssistantId === id) {
                currentConfig.activeAssistantId = currentConfig.assistants[0].id;
            }

            // Re-populate everything
            populateAssistants();
        }
    }

    function saveSettingsFromUI() {
        currentConfig.apiEndpoint = DOM.setApiUrl.value.trim().replace(/\/v1\/?$/, ''); // Normalize base url to not end with /v1
        currentConfig.apiKey = DOM.setApiKey.value.trim();
        currentConfig.modelId = DOM.setModelId.value;
        currentConfig.followUpModelId = DOM.setFollowupModelId.value;
        currentConfig.streamResponses = DOM.setStream.checked;

        saveConfig(currentConfig);
        alert('设置已保存');
        switchView('chat');
    }

    async function fetchModelsFromAPI() {
        const baseUrl = DOM.setApiUrl.value.trim().replace(/\/v1\/?$/, '') + '/v1';
        const apiKey = DOM.setApiKey.value.trim();

        if (!apiKey) {
            alert('请先输入 API Key');
            return;
        }

        DOM.btnFetchModels.textContent = '获取中...';
        DOM.btnFetchModels.disabled = true;

        try {
            GM_xmlhttpRequest({
                method: 'GET',
                url: `${baseUrl}/models`,
                headers: {
                    'Authorization': `Bearer ${apiKey}`
                },
                onload: function (response) {
                    try {
                        if (response.status >= 200 && response.status < 300) {
                            const data = JSON.parse(response.responseText);
                            if (data && data.data) {
                                const modelIds = data.data.map(m => m.id).sort();
                                updateModelSelects(modelIds);
                                alert(`成功获取 ${modelIds.length} 个模型`);
                            }
                        } else {
                            throw new Error(`HTTP Error: ${response.status}`);
                        }
                    } catch (e) {
                        console.error(e);
                        alert('获取模型失败，解析错误或 API Key 无效: ' + e.message);
                    } finally {
                        DOM.btnFetchModels.textContent = '获取列表';
                        DOM.btnFetchModels.disabled = false;
                    }
                },
                onerror: function () {
                    alert('获取模型失败，请检查 Base URL / 网络连接');
                    DOM.btnFetchModels.textContent = '获取列表';
                    DOM.btnFetchModels.disabled = false;
                }
            });
        } catch (err) {
            console.error(err);
            alert('获取模型失败: ' + err.message);
            DOM.btnFetchModels.textContent = '获取列表';
            DOM.btnFetchModels.disabled = false;
        }
    }

    function updateModelSelects(modelIds) {
        // De-duplicate and add
        const uniqueModels = [...new Set(modelIds)];
        const mainSelect = DOM.setModelId;
        const subSelect = DOM.setFollowupModelId;

        const currentMain = mainSelect.value;
        const currentSub = subSelect.value;

        mainSelect.innerHTML = '';
        subSelect.innerHTML = '';

        uniqueModels.forEach(id => {
            mainSelect.appendChild(new Option(id, id));
            subSelect.appendChild(new Option(id, id));
        });

        if (uniqueModels.includes(currentMain)) mainSelect.value = currentMain;
        if (uniqueModels.includes(currentSub)) subSelect.value = currentSub;
    }

    // ==========================================
    // Import / Export
    // ==========================================
    function exportConfig() {
        const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(currentConfig, null, 2));
        const downloadAnchorNode = document.createElement('a');
        downloadAnchorNode.setAttribute("href", dataStr);
        downloadAnchorNode.setAttribute("download", "ai_assistant_config.json");
        document.body.appendChild(downloadAnchorNode); // required for firefox
        downloadAnchorNode.click();
        downloadAnchorNode.remove();
    }

    function importConfig(e) {
        const file = e.target.files[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = function (e) {
            try {
                const newConfig = JSON.parse(e.target.result);
                // Basic validation
                if (newConfig && newConfig.assistants) {
                    currentConfig = { ...DEFAULT_CONFIG, ...newConfig };
                    saveConfig(currentConfig);
                    populateSettings();
                    populateAssistants();
                    alert("导入成功！");
                } else {
                    alert("无效的配置文件格式。");
                }
            } catch (err) {
                alert("读取文件失败: " + err);
            }
        };
        reader.readAsText(file);
        DOM.fileImport.value = ''; // Reset
    }

    // ==========================================
    // Page Content Extraction (Readability)
    // ==========================================
    function getPageContent() {
        if (pageContentCache) return pageContentCache;

        try {
            // Clone document to not mess with the live DOM during parsing
            let documentClone = document.cloneNode(true);
            let article = new Readability(documentClone).parse();

            // Fallback to innerText if readability fails or returns empty
            let contentText = article && article.textContent ? article.textContent.trim() : document.body.innerText.trim();

            // Clean up excess whitespace
            contentText = contentText.replace(/\n\s*\n/g, '\n\n');

            pageContentCache = contentText;
            return contentText;
        } catch (e) {
            console.warn("Readability failed, falling back to innerText", e);
            return document.body.innerText.substring(0, 10000); // safety limit
        }
    }

    // ==========================================
    // Chat & OpenAI API Integration
    // ==========================================
    function renderMarkdown(text) {
        if (typeof marked !== 'undefined' && typeof DOMPurify !== 'undefined') {
            return DOMPurify.sanitize(marked.parse(text));
        }
        return text.replace(/\n/g, '<br>'); // Fallback
    }

    function appendMessage(role, text) {
        const msgDiv = document.createElement('div');
        msgDiv.className = `ai-message ai-msg-${role}`;

        if (role === 'assistant') {
            msgDiv.innerHTML = renderMarkdown(text);
        } else {
            // Escape user input
            const safeText = text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
            msgDiv.innerHTML = safeText.replace(/\n/g, '<br>');
        }

        DOM.chatMessages.appendChild(msgDiv);
        DOM.chatMessages.scrollTop = DOM.chatMessages.scrollHeight;
        return msgDiv;
    }

    function updateAssistantMessage(msgDiv, newText) {
        msgDiv.innerHTML = renderMarkdown(newText);
        // Throttle scroll down during streaming to avoid jitters
        if (DOM.chatMessages.scrollHeight - DOM.chatMessages.scrollTop < 600) {
            DOM.chatMessages.scrollTop = DOM.chatMessages.scrollHeight;
        }
    }

    async function handleSummarizeClick() {
        if (isWaitingForResponse) return;
        DOM.chatTextarea.value = "请总结这篇主要内容"; // Will be appended to the custom user prompt template
        await handleSendChat();
    }

    async function handleSendChat() {
        if (isWaitingForResponse) return;

        const text = DOM.chatTextarea.value.trim();
        if (!text) return;

        if (!currentConfig.apiKey) {
            alert('请先在"设置"中配置 API Key');
            switchView('settings');
            return;
        }

        DOM.chatTextarea.value = '';
        DOM.chatTextarea.style.height = 'auto'; // Reset size
        DOM.followUps.innerHTML = ''; // Clear old follow-ups

        appendMessage('user', text);

        const assistantId = DOM.assistantSelect.value;
        const currentAssistant = currentConfig.assistants.find(a => a.id === assistantId) || currentConfig.assistants[0];

        // Prepare context
        // If it's the very first message in the session, we use the user prompt template injected with page content
        let finalPrompt = text;
        if (chatHistory.length === 0) {
            const pageText = getPageContent();
            finalPrompt = currentAssistant.userPrompt.replace('{{ content }}', pageText) + '\n\n[附加请求]:\n' + text;
        }

        chatHistory.push({ role: 'user', content: finalPrompt });

        isWaitingForResponse = true;
        DOM.chatSend.disabled = true;
        const msgDiv = appendMessage('assistant', '...');

        await streamOpenAI(
            currentConfig.modelId,
            [{ role: 'system', content: currentAssistant.systemPrompt }, ...chatHistory],
            (chunk) => {
                // Streaming callback
                // Note: we need to accumulate chunks
            },
            msgDiv
        );
    }

    async function streamOpenAI(model, messages, onChunk, msgDiv) {
        const baseUrl = currentConfig.apiEndpoint.replace(/\/v1\/?$/, '') + '/v1';
        let fullResponse = '';
        let processedLength = 0;
        let buffer = '';

        try {
            GM_xmlhttpRequest({
                method: 'POST',
                url: `${baseUrl}/chat/completions`,
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${currentConfig.apiKey}`
                },
                data: JSON.stringify({
                    model: model,
                    messages: messages,
                    stream: currentConfig.streamResponses !== false
                }),
                onreadystatechange: function (response) {
                    if (currentConfig.streamResponses === false) return; // Skip chunk processing for non-streaming

                    if (response.readyState === 3 || response.readyState === 4) {
                        const newText = response.responseText.substring(processedLength);
                        if (!newText) return;
                        processedLength = response.responseText.length;

                        buffer += newText;
                        const lines = buffer.split('\n\n');
                        buffer = lines.pop() || ''; // Keep incomplete part in buffer

                        for (const line of lines) {
                            if (line.trim().startsWith('{') && line.includes('"error"')) {
                                try {
                                    const errData = JSON.parse(line);
                                    if (errData.error) {
                                        updateAssistantMessage(msgDiv, `**API Error:** ${errData.error.message}`);
                                        buffer = ''; // clear buffer
                                    }
                                } catch (e) { }
                            } else if (line.startsWith('data: ') && line !== 'data: [DONE]') {
                                try {
                                    const data = JSON.parse(line.slice(6));
                                    if (data.choices && data.choices[0].delta && data.choices[0].delta.content) {
                                        fullResponse += data.choices[0].delta.content;
                                        updateAssistantMessage(msgDiv, fullResponse);
                                    }
                                } catch (e) {
                                    console.error('Error parsing JSON chunk', e, line);
                                }
                            }
                        }
                    }
                },
                onload: function (response) {
                    if (currentConfig.streamResponses === false) {
                        try {
                            const data = JSON.parse(response.responseText);
                            if (data.error) {
                                updateAssistantMessage(msgDiv, `**API Error:** ${data.error.message}`);
                            } else if (data.choices && data.choices[0].message && data.choices[0].message.content) {
                                fullResponse = data.choices[0].message.content;
                                updateAssistantMessage(msgDiv, fullResponse);
                            }
                        } catch (e) {
                            console.error('Failed to parse non-stream response', e);
                            if (!fullResponse) updateAssistantMessage(msgDiv, `**Raw Error:** ${response.responseText}`);
                        }
                    }

                    if (fullResponse) {
                        chatHistory.push({ role: 'assistant', content: fullResponse });
                    }
                    generateFollowUps();
                    isWaitingForResponse = false;
                    DOM.chatSend.disabled = false;
                },
                onerror: function (error) {
                    console.error('API Error:', error);
                    updateAssistantMessage(msgDiv, `**Error:** Network request failed (CORS or network issue). Please check your Base URL and proxy settings.`);
                    isWaitingForResponse = false;
                    DOM.chatSend.disabled = false;
                }
            });

        } catch (error) {
            console.error('Fetch Error:', error);
            updateAssistantMessage(msgDiv, `**Error:** ${error.message}`);
            isWaitingForResponse = false;
            DOM.chatSend.disabled = false;
        }
    }

    // ==========================================
    // Auto Follow-up Questions Generation
    // ==========================================
    async function generateFollowUps() {
        if (!currentConfig.followUpModelId) return;

        DOM.followUps.innerHTML = '<span style="color:#94a3b8; font-size:12px;">正在生成追问建议...</span>';

        // Prepare context for follow ups. We only need the last few exchanges.
        const recentHistory = chatHistory.slice(-3).map(m => `${m.role}: ${m.content.substring(0, 500)}`).join('\n');

        try {
            const baseUrl = currentConfig.apiEndpoint.replace(/\/v1\/?$/, '') + '/v1';

            GM_xmlhttpRequest({
                method: 'POST',
                url: `${baseUrl}/chat/completions`,
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${currentConfig.apiKey}`
                },
                data: JSON.stringify({
                    model: currentConfig.followUpModelId,
                    messages: [
                        { role: 'system', content: 'You are an assistant that suggests 3 short, insightful follow-up questions the user might ask about the current conversation topic or web page. Return ONLY a JSON array of strings.' },
                        { role: 'user', content: `Recent conversation:\n${recentHistory}\n\nSuggest 3 follow-up questions.` }
                    ],
                    stream: false
                }),
                onload: function (response) {
                    if (response.status >= 200 && response.status < 300) {
                        try {
                            const data = JSON.parse(response.responseText);
                            let questions = [];
                            const content = data.choices[0].message.content;
                            // Try to parse as JSON.
                            const parsed = JSON.parse(content);
                            if (Array.isArray(parsed)) questions = parsed;
                            else if (parsed.questions && Array.isArray(parsed.questions)) questions = parsed.questions;
                            else {
                                // Regex fallback
                                const matches = content.match(/"([^"]*)"/g);
                                if (matches) questions = matches.map(s => s.replace(/"/g, ''));
                            }

                            DOM.followUps.innerHTML = '';
                            if (questions.length > 0) {
                                questions.forEach(q => {
                                    const btn = document.createElement('button');
                                    btn.className = 'ai-follow-up-chip';
                                    btn.textContent = q;
                                    btn.title = q;
                                    btn.onclick = () => {
                                        DOM.chatTextarea.value = q;
                                        handleSendChat();
                                    };
                                    DOM.followUps.appendChild(btn);
                                });
                            }
                        } catch (e) {
                            console.log("Failed to parse followups as JSON", e);
                            DOM.followUps.innerHTML = '';
                        }
                    } else {
                        DOM.followUps.innerHTML = '';
                    }
                },
                onerror: function () {
                    console.error("Failed to generate followups (Network)");
                    DOM.followUps.innerHTML = '';
                }
            });

        } catch (e) {
            console.error("Failed to generate followups", e);
            DOM.followUps.innerHTML = '';
        }
    }

    // Initialize when DOM is ready
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }

})();
