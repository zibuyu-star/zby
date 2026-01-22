// ==========================================
// 全局状态控制
// ==========================================
let isPaused = false;
let isRunning = false;

// ==========================================
// 工具函数
// ==========================================
const sleep = (ms) => new Promise(r => setTimeout(r, ms));



// ===== 随机等待（用于私信阶段节奏控制）=====
function randInt(min, max) {
    return Math.floor(min + Math.random() * (max - min + 1));
}
async function sleepRand(minMs = 2000, maxMs = 4000) {
    await sleep(randInt(minMs, maxMs));
}
// ===== 随机等待结束 =====
async function simulateClick(element) {
    if (!element) return;
    try {
        const oldBorder = element.style.border;
        element.style.border = "3px solid red"; // 视觉反馈
        await sleep(200);
        element.style.border = oldBorder;
    } catch(e){}

    const events = ['mousedown', 'mouseup', 'click'];
    events.forEach(etype => {
        element.dispatchEvent(new MouseEvent(etype, { bubbles: true, cancelable: true, view: window }));
    });
    if (typeof element.click === 'function') element.click();
}

// ===== 稳定筛选修复（严格沿用独立版逻辑）=====
async function ensureOrderIdFilterStrict() {
    const sleepLocal = (ms) => new Promise(r => setTimeout(r, ms));

    function isVisible(el){
        if(!el) return false;
        const r = el.getBoundingClientRect();
        return r.width > 0 && r.height > 0;
    }

    async function waitFor(fn, {timeout=15000, interval=200}={}){
        const start = Date.now();
        while(Date.now()-start < timeout){
            try{
                const v = fn();
                if(v) return v;
            }catch(e){}
            await sleepLocal(interval);
        }
        throw new Error('waitFor timeout');
    }

    function click(el){
        el.scrollIntoView({block:'center'});
        const opts = {bubbles:true, cancelable:true, view:window};
        el.dispatchEvent(new MouseEvent('mouseover', opts));
        el.dispatchEvent(new MouseEvent('mousedown', opts));
        el.dispatchEvent(new MouseEvent('mouseup', opts));
        el.dispatchEvent(new MouseEvent('click', opts));
    }

    async function clickAllTab(){
        const tab = await waitFor(() =>
            Array.from(document.querySelectorAll('div.m4b-tabs-pane-title-content'))
                .find(d => d.textContent.trim() === '全部')
        );
        if(!isVisible(tab)) throw new Error('全部 tab not visible');
        click(tab);
    }

    async function openSelect(){
        const view = await waitFor(() =>
            Array.from(document.querySelectorAll('span.arco-select-view-value'))
                .find(s => s.textContent.trim() === '达人昵称')
        );
        click(view);
    }

    async function chooseOrderId(){
        const option = await waitFor(() =>
            Array.from(document.querySelectorAll('li.arco-select-option'))
                .find(li => li.textContent.trim() === '订单 ID')
        );
        if(!isVisible(option)) option.scrollIntoView({block:'center'});
        click(option);
    }

    await clickAllTab();
    await sleepLocal(300);
    await openSelect();
    await sleepLocal(300);
    await chooseOrderId();
    console.log('[筛选修复] 完成');
}
// ===== 稳定筛选修复结束 =====



function simulateInput(element, value) {
    if (!element) return;
    element.focus();
    
    const isTextarea = element.tagName === 'TEXTAREA';
    const proto = isTextarea ? window.HTMLTextAreaElement.prototype : window.HTMLInputElement.prototype;
    const setter = Object.getOwnPropertyDescriptor(proto, "value").set;
    
    if (setter) setter.call(element, value);
    else element.value = value;
    
    element.dispatchEvent(new Event('input', { bubbles: true }));
    element.dispatchEvent(new Event('change', { bubbles: true }));
    setTimeout(() => element.blur(), 50);
}

// ==========================================
// 主流程
// ==========================================
async function runAutomation(orderIds, messageText) {
    // 先严格执行独立版的筛选修复逻辑（点击“全部”+切换为“订单 ID”）
    try { await ensureOrderIdFilterStrict(); } catch(e) { console.warn('[筛选修复] 跳过/失败：', e); }

    if (isRunning) return console.warn('alert 已移除');
    isRunning = true;
    isPaused = false;
    
    console.log(`🚀 开始任务，共 ${orderIds.length} 个订单`);

    // --- 1. 初始化 (切换到订单 ID) ---
    try {
        const allTab = Array.from(document.querySelectorAll('div')).find(el => el.innerText.trim() === '全部');
        if (allTab) { await simulateClick(allTab); await sleep(1500); }

        const currentVal = document.querySelector('.arco-select-view-value');
        if (currentVal && !currentVal.innerText.includes('订单')) {
            const dropdown = document.querySelector('.arco-select-view');
            if (dropdown) {
                await simulateClick(dropdown);
                await sleep(500);
                let target = null;
                for(let k=0; k<10; k++) {
                    const opts = document.querySelectorAll('.arco-select-option');
                    for(let o of opts) {
                        if(o.innerText.replace(/\s/g,'').includes('订单ID')) {
                            target = o; break;
                        }
                    }
                    if(target) break;
                    await sleep(500);
                }
                if(target) { await simulateClick(target); await sleep(1000); }
            }
        }
    } catch(e) { console.warn("初始化小异常:", e); }

    // --- 2. 循环处理 ---
    for (let i = 0; i < orderIds.length; i++) {
        // --- ⏸️ 暂停检查点 ---
        while (isPaused) {
            console.log("⏸️ 任务暂停中... (点击'暂停/继续'以恢复)");
            await sleep(1000);
        }

        const oid = orderIds[i];
        console.log(`\n🔵 [${i+1}/${orderIds.length}] 处理订单: ${oid}`);

        try {
            // A. 输入订单号
            const input = document.querySelector('input[placeholder*="订单"]') || 
                          document.querySelector('input[data-tid="m4b_input_search"]');
            if(!input) { console.error("找不到搜索框"); continue; }
            
            simulateInput(input, "");
            await sleep(200);
            simulateInput(input, oid);
            await sleep(500);

            // B. 搜索 (回车+点击)
            input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', keyCode: 13, bubbles: true }));
            const searchIcon = document.querySelector('.arco-icon-search');
            if(searchIcon) await simulateClick(searchIcon.closest('.arco-input-group-suffix') || searchIcon);
            
            console.log("⏳ 等待搜索结果...");

            // C. 找聊天按钮（合并订单：优先选择“状态=内容处理中”的那一条记录）
            let chatBtn = null;

            // 1) 优先：精确按“订单号所在行/卡片”匹配，并在该行内匹配状态 DOM（<div ...>内容处理中</div>）
            try {
                const oidText = String(oid).trim();

                // 先锁定表格行（TikTok Shop 常见：arco-table）
                const rows = Array.from(document.querySelectorAll('tbody tr, .arco-table-body tr, tr'))
                    .filter(tr => (tr.innerText || '').includes(oidText));

                // 在这些行中，找状态为“内容处理中”的行
                let targetRow = null;
                for (const tr of rows) {
                    // 状态可能是一个 div 文本，也可能嵌套在 span/div 内，这里用 textContent 更稳
                    const hasProcessing = Array.from(tr.querySelectorAll('div, span'))
                        .some(el => (el.textContent || '').trim() === '内容处理中');
                    if (hasProcessing) { targetRow = tr; break; }
                }

                if (targetRow) {
                    const icon = targetRow.querySelector('.arco-icon-message');
                    if (icon) chatBtn = icon.closest('button') || icon.parentElement;
                }
            } catch (e) {
                // 忽略，走兜底逻辑
            }

            // 2) 若表格行没命中（有时是卡片/列表结构），用更宽松的“包含订单号的块” + 状态 DOM 精确文本
            if (!chatBtn) {
                try {
                    const oidText = String(oid).trim();
                    const blocks = Array.from(document.querySelectorAll('div'))
                        .filter(d => (d.innerText || '').includes(oidText));

                    const targetBlock = blocks.find(b => {
                        return Array.from(b.querySelectorAll('div, span'))
                            .some(el => (el.textContent || '').trim() === '内容处理中');
                    });

                    if (targetBlock) {
                        const icon = targetBlock.querySelector('.arco-icon-message');
                        if (icon) chatBtn = icon.closest('button') || icon.parentElement;
                    }
                } catch (e) {}
            }

            // 3) 兜底：原逻辑 - 找到第一个可见的聊天按钮
            if (!chatBtn) {
                for (let t = 0; t < 15; t++) {
                    const icons = Array.from(document.querySelectorAll('.arco-icon-message'));
                    const visible = icons.find(ic => ic.offsetParent !== null);
                    if (visible) {
                        chatBtn = visible.closest('button') || visible.parentElement;
                        break;
                    }
                    await sleep(1000);
                }
            }

            if (chatBtn) {
                await simulateClick(chatBtn);
                await sleepRand(); // 随机等待 2-4s，等待弹窗
            } else {
                console.warn("⚠️ 没搜到订单或没按钮，跳过");
                continue;
            }

            // D. 点击 提醒/发送
            // 每次操作前都检查暂停
            while (isPaused) await sleep(1000);

            const allBtns = Array.from(document.querySelectorAll('button'));
            const remindBtn = allBtns.find(b => b.innerText.includes('提醒') && b.offsetParent !== null);
            let done = false;

            if (remindBtn && !remindBtn.disabled && !remindBtn.classList.contains('arco-btn-disabled')) {
                console.log("✅ 点击【提醒】");
                await simulateClick(remindBtn);
                await sleepRand();
                done = true;
                await sleep(1500);
            }

            if (!done) {
                const cardSend = allBtns.find(b => b.innerText.trim()==='发送' && b.classList.contains('m4b-button-link') && b.offsetParent!==null);
                if(cardSend) {
                    console.log("✅ 点击卡片【发送】");
                    await simulateClick(cardSend);
                    await sleepRand();
                }
            }

            // E. 输入话术
            while (isPaused) await sleep(1000);

            const txtArea = document.querySelector('textarea[placeholder="发送消息"]');
            if(txtArea) {
                simulateInput(txtArea, messageText);
                await sleepRand();
                const sendBtn = allBtns.find(b => b.innerText.trim()==='发送' && b.classList.contains('arco-btn-primary') && !b.classList.contains('m4b-button-link') && b.offsetParent!==null);
                if(sendBtn) {
                    await simulateClick(sendBtn);
                    console.log("💬 消息已发送");
                    await sleepRand();
                }
            }

            // F. 关闭弹窗 (精准匹配 SVG)
            console.log("❎ 关闭弹窗");
            
            // 优先策略：查找包含您提供的 SVG 路径的图标
            // 这个 SVG path 对应的是那个绿色的关闭叉叉
            const closeSvgPath = "M3.367 7.5A.37.37"; 
            const allSvgs = document.querySelectorAll('svg');
            let closeIcon = null;

            // 1. 尝试通过 SVG path 匹配
            for(let svg of allSvgs) {
                if(svg.innerHTML.includes(closeSvgPath)) {
                    closeIcon = svg;
                    break;
                }
            }

            // 2. 如果没找到，尝试通过通用 class 匹配
            if(!closeIcon) {
                closeIcon = document.querySelector('.arco-modal-close-icon');
            }

            // 执行关闭
            if (closeIcon) {
                // 有时候 SVG 本身点不动，要点它的父级
                await simulateClick(closeIcon.closest('div[tabindex]') || closeIcon.parentElement || closeIcon);
            } else {
                // 兜底：ESC 键
                document.body.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
            }
            
            await sleep(1500); // 冷却

        } catch (err) {
            console.error(`❌ 订单 ${oid} 异常:`, err);
        }
    }
    
    isRunning = false;
    console.warn('alert 已移除');
}

// 监听消息
chrome.runtime.onMessage.addListener((req, sender, sendResponse) => {
    if (req.type === "START") {
        runAutomation(req.orderIds, req.message);
    } else if (req.type === "TOGGLE_PAUSE") {
        isPaused = !isPaused;
        console.log(isPaused ? "⏸️ 已暂停" : "▶️ 继续运行");
        // 给用户一个反馈，虽然是在控制台
        if(isPaused) console.warn('alert 已移除');
    }
});