let addresses = [];

const connection = new solanaWeb3.Connection(
    'https://api.mainnet-beta.solana.com',
    'confirmed'
);

const TOKEN_PROGRAM_ID = new solanaWeb3.PublicKey(
    'TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA'
);

// 基础UI函数
function addAddress() {
    const addressInput = document.getElementById('addressInput');
    const noteInput = document.getElementById('noteInput');
    const address = addressInput.value.trim();
    const note = noteInput.value.trim();

    if (!address) {
        alert('请输入地址');
        return;
    }

    try {
        new solanaWeb3.PublicKey(address);
    } catch (error) {
        alert('无效的Solana地址');
        return;
    }

    addresses.push({
        address: address,
        note: note || address.slice(0, 4) + '...' + address.slice(-4),
        selected: true
    });

    updateAddressList();
    addressInput.value = '';
    noteInput.value = '';
}

function updateAddressList() {
    const addressList = document.getElementById('addressList');
    addressList.innerHTML = addresses.map((addr, index) => `
        <div class="address-item">
            <input type="checkbox" 
                   ${addr.selected ? 'checked' : ''} 
                   onchange="toggleAddress(${index})">
            <span>${addr.note}</span>
            <button onclick="removeAddress(${index})">删除</button>
        </div>
    `).join('');
}

function toggleAddress(index) {
    addresses[index].selected = !addresses[index].selected;
    updateAddressList();
}

function removeAddress(index) {
    addresses.splice(index, 1);
    updateAddressList();
}

// 获取Raydium价格数据
async function getRaydiumPrices() {
    const response = await fetch('https://api.raydium.io/v2/main/price');
    if (!response.ok) {
        throw new Error('Raydium API请求失败');
    }
    const data = await response.json();
    return new Map(data.map(item => [item.mint, item]));
}

// 获取代币账户信息
async function getTokenAccounts(address) {
    try {
        const pubKey = new solanaWeb3.PublicKey(address);
        const response = await connection.getParsedTokenAccountsByOwner(
            pubKey,
            {
                programId: TOKEN_PROGRAM_ID
            }
        );

        return response.value
            .map(item => ({
                mint: item.account.data.parsed.info.mint,
                amount: item.account.data.parsed.info.tokenAmount.amount,
                decimals: item.account.data.parsed.info.tokenAmount.decimals,
                uiAmount: item.account.data.parsed.info.tokenAmount.uiAmount
            }))
            .filter(token => token.uiAmount > 0);
    } catch (error) {
        console.error('获取代币账户信息失败:', error);
        throw error;
    }
}

// 找出共同的代币Mint地址
function findCommonMints(addressesTokens) {
    const mintsArrays = addressesTokens.map(
        at => at.tokens.map(t => t.mint)
    );
    return mintsArrays.reduce((common, current) => 
        common.filter(mint => current.includes(mint))
    );
}

// 显示结果
function displayResults(tokenDetails, selectedAddresses) {
    const results = document.getElementById('results');
    
    if (tokenDetails.length === 0) {
        results.innerHTML = '<p>未找到共同代币</p>';
        return;
    }

    let html = '<table class="token-table"><thead><tr>' +
        '<th>代币</th>' +
        '<th>价格</th>';
    
    selectedAddresses.forEach(addr => {
        html += `<th>${addr.note}</th>`;
    });
    
    html += '</tr></thead><tbody>';

    tokenDetails.forEach(token => {
        html += `<tr>
            <td>${token.symbol}<br>(${token.address})</td>
            <td>$${token.price.toFixed(4)}</td>`;
        
        selectedAddresses.forEach(addr => {
            const holding = token.holdings[addr.address];
            if (holding) {
                html += `<td>
                    ${holding.uiAmount.toFixed(4)}<br>
                    $${holding.value.toFixed(2)}<br>
                    (${holding.percentage})
                </td>`;
            } else {
                html += '<td>0</td>';
            }
        });
        
        html += '</tr>';
    });

    html += '</tbody></table>';
    results.innerHTML = html;
}

// 主查询函数
async function findCommonTokens() {
    const selectedAddresses = addresses.filter(a => a.selected);
    
    if (selectedAddresses.length < 2) {
        alert('请至少选择两个地址进行比较');
        return;
    }

    const loading = document.getElementById('loading');
    const results = document.getElementById('results');
    const searchBtn = document.getElementById('searchBtn');

    loading.style.display = 'block';
    searchBtn.disabled = true;
    results.innerHTML = '';

    try {
        // 获取Raydium价格数据
        const priceMap = await getRaydiumPrices();

        // 获取所有选中地址的代币账户
        const addressesTokens = await Promise.all(
            selectedAddresses.map(async (addr) => {
                const tokens = await getTokenAccounts(addr.address);
                return {
                    address: addr.address,
                    note: addr.note,
                    tokens: tokens.filter(token => priceMap.has(token.mint))
                };
            })
        );

        // 找出共同的代币
        const commonTokens = findCommonMints(addressesTokens);
        
        // 处理共同代币的详细信息
        const tokenDetails = commonTokens.map(mint => {
            const tokenInfo = priceMap.get(mint);
            const holdings = {};

            // 计算每个地址的持仓
            for (const addrTokens of addressesTokens) {
                const tokenAccount = addrTokens.tokens.find(
                    t => t.mint === mint
                );
                if (tokenAccount) {
                    const value = tokenAccount.uiAmount * tokenInfo.price;
                    holdings[addrTokens.address] = {
                        balance: tokenAccount.amount,
                        uiAmount: tokenAccount.uiAmount,
                        value: value,
                        percentage: '0%'
                    };
                }
            }

            // 计算总价值和百分比
            const totalValue = Object.values(holdings)
                .reduce((sum, h) => sum + h.value, 0);
            
            for (const addr in holdings) {
                holdings[addr].percentage = 
                    ((holdings[addr].value / totalValue) * 100).toFixed(2) + '%';
            }

            return {
                symbol: tokenInfo.symbol,
                name: tokenInfo.symbol,
                address: mint,
                price: tokenInfo.price,
                holdings: holdings
            };
        });

        // 按总价值排序
        tokenDetails.sort((a, b) => {
            const totalValueA = Object.values(a.holdings)
                .reduce((sum, h) => sum + h.value, 0);
            const totalValueB = Object.values(b.holdings)
                .reduce((sum, h) => sum + h.value, 0);
            return totalValueB - totalValueA;
        });

        displayResults(tokenDetails, selectedAddresses);

    } catch (error) {
        console.error('查询失败:', error);
        results.innerHTML = '获取数据时发生错误: ' + error.message;
    } finally {
        loading.style.display = 'none';
        searchBtn.disabled = false;
    }
}
