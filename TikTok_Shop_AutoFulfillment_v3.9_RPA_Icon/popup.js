// --- 1. 初始化：读取保存的内容 ---
document.addEventListener('DOMContentLoaded', () => {
    const savedIds = localStorage.getItem('TIKTOK_IDS');
    const savedMsg = localStorage.getItem('TIKTOK_MSG');
    if (savedIds) document.getElementById('orderIds').value = savedIds;
    if (savedMsg) document.getElementById('message').value = savedMsg;
});

// --- 2. 实时保存 ---
const idInput = document.getElementById('orderIds');
const msgInput = document.getElementById('message');

idInput.addEventListener('input', () => localStorage.setItem('TIKTOK_IDS', idInput.value));
msgInput.addEventListener('input', () => localStorage.setItem('TIKTOK_MSG', msgInput.value));

// --- 3. 一键清空 ---
document.getElementById('clearBtn').addEventListener('click', () => {
    if(confirm("确定要清空所有订单 ID 吗？")) {
        idInput.value = "";
        localStorage.setItem('TIKTOK_IDS', "");
    }
});

// --- 4. 辅助函数：发送消息给当前 Tab ---
async function sendMsgToContent(messageObj) {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (!tab || !tab.url || !tab.url.includes("affiliate.tiktokshopglobalselling.com")) {
        return console.warn('页面校验失败，已忽略弹窗');
    }

    const trySend = () => new Promise((resolve, reject) => {
        chrome.tabs.sendMessage(tab.id, messageObj, (resp) => {
            const err = chrome.runtime.lastError;
            if (err) reject(err);
            else resolve(resp);
        });
    });

    try {
        return await trySend();
    } catch (e) {
        // 常见原因：SPA 路由切换/刚打开页面导致 content script 未就绪
        try {
            await chrome.scripting.executeScript({
                target: { tabId: tab.id },
                files: ["content.js"]
            });
        } catch (injErr) {
            console.warn("注入 content.js 失败：", injErr);
        }
        try {
            return await trySend();
        } catch (e2) {
            console.error(e2);
            console.warn('未在样品申请页面，已忽略提醒');
        }
    }
}

// --- 5. 开始运行 ---
document.getElementById('runBtn').addEventListener('click', () => {
    const ids = idInput.value.trim();
    const msg = msgInput.value;
    if (!ids) return alert("请输入订单 ID！");

    sendMsgToContent({
        type: "START",
        orderIds: ids.split('\n').map(s => s.trim()).filter(Boolean),
        message: msg
    });
});

// --- 6. 暂停/继续 ---
document.getElementById('pauseBtn').addEventListener('click', () => {
    sendMsgToContent({ type: "TOGGLE_PAUSE" });
});