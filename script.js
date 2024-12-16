let addresses = [];

const connection = new solanaWeb3.Connection(
    'https://api.mainnet-beta.solana.com',
    'confirmed'
);

const TOKEN_PROGRAM_ID = new solanaWeb3.PublicKey(
    'TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA'
);

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

// [其他函数保持不变，从之前的代码复制过来]
