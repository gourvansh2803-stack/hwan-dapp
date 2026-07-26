import { useState, useEffect } from 'react';
import { ethers } from 'ethers';
import { CONTRACT_ABI, USDT_ABI } from './constants';

function App() {
  const [account, setAccount] = useState(null);
  const [isRegistered, setIsRegistered] = useState(false);
  const [destination, setDestination] = useState("");
  const [inputDest, setInputDest] = useState("");
  const [history, setHistory] = useState([]);
  const [loading, setLoading] = useState(false);
  const [signupFee, setSignupFee] = useState("35.00");
  const [showPopup, setShowPopup] = useState(false);
  const [timeLeft, setTimeLeft] = useState(null);

  const NEW_CONTRACT_ADDRESS = "0xDF544FF9FF3f616734Ba4d302B58EebD8f6D6057"; 
  const USDT_ADDRESS = "0x55d398326f99059fF775485246999027B3197955";
  const HWAN_ADDRESS = "0x3e79740e5dA9e04Ad623954503Ef594F9F66eFE1";

  const connectWallet = async () => {
    if (window.ethereum) {
      const provider = new ethers.BrowserProvider(window.ethereum);
      const signer = await provider.getSigner();
      const address = await signer.getAddress();
      setAccount(address);
      checkRegistration(address, provider);
    }
  };

  // 🔥 Smart contract se exact data fetch karke strict expiry check karne ka function
  const loadTimerAndCheck = async (contract, userAddress, provider) => {
    try {
      const data = await contract.getUserDashboardData(userAddress);
      const registered = data[0];
      const dest = data[1];
      
      const fee = await contract.signupFee();
      setSignupFee(ethers.formatUnits(fee, 18));

      if (registered) {
        // Smart contract se user ki struct details nikalna (lastSignupTime index [3] par hai)
        const user = await contract.users(userAddress);
        const lastSignup = Number(user.lastSignupTime || user[3] || 0);
        const interval = Number(await contract.renewalInterval() || (2 * 24 * 3600)); 

        const expiry = lastSignup + interval;
        const now = Math.floor(Date.now() / 1000);
        const remain = expiry - now;

        // Agar time khatam ho gaya hai toh dashboard mat dikhao, seedha Signup/Renewal page par bhejo
        if (remain <= 0 || lastSignup === 0) {
          setIsRegistered(false);
          setTimeLeft(0);
        } else {
          setIsRegistered(true);
          setDestination(dest);
          setTimeLeft(remain * 1000);
          fetchHistory(userAddress, provider);
          setShowPopup(true);
          setTimeout(() => setShowPopup(false), 8000);
        }
      } else {
        setIsRegistered(false);
        setTimeLeft(0);
      }
    } catch (e) {
      console.error("Error checking registration:", e);
      setIsRegistered(false);
    }
  };

  const checkRegistration = async (userAddress, provider) => {
    const contract = new ethers.Contract(NEW_CONTRACT_ADDRESS, CONTRACT_ABI, provider);
    await loadTimerAndCheck(contract, userAddress, provider);
  };

  // 🔥 Live Countdown Timer Effect
  useEffect(() => {
    if (timeLeft === null || timeLeft <= 0) return;

    const timer = setInterval(() => {
      setTimeLeft(prev => {
        if (prev <= 1000) {
          clearInterval(timer);
          setIsRegistered(false); // Time khatam hote hi automatic signup/renewal page par le jayega
          return 0;
        }
        return prev - 1000;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [timeLeft]);

  const formatTime = (ms) => {
    if (ms <= 0) return "Expired";
    const totalSeconds = Math.floor(ms / 1000);
    const days = Math.floor(totalSeconds / (3600 * 24));
    const hours = Math.floor((totalSeconds % (3600 * 24)) / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const seconds = totalSeconds % 60;
    return `${days}d ${hours}h ${minutes}m ${seconds}s`;
  };

  const handleSignUp = async () => {
    setLoading(true);
    try {
      const provider = new ethers.BrowserProvider(window.ethereum);
      const signer = await provider.getSigner();
      const usdtContract = new ethers.Contract(USDT_ADDRESS, ["function approve(address spender, uint256 amount) public returns (bool)"], signer);
      const coreContract = new ethers.Contract(NEW_CONTRACT_ADDRESS, CONTRACT_ABI, signer);
      
      const approveTx = await usdtContract.approve(NEW_CONTRACT_ADDRESS, ethers.MaxUint256, { gasLimit: 100000 });
      await approveTx.wait();
      
      const ref = "0x0000000000000000000000000000000000000000";
      const regTx = await coreContract.register(ref, { gasLimit: 800000 });
      await regTx.wait();
      
      const address = await signer.getAddress();
      await loadTimerAndCheck(coreContract, address, provider); 
      
      alert("Registration / Renewal Successful!");
      setShowPopup(true);
      setTimeout(() => setShowPopup(false), 8000);
    } catch (e) { 
      console.error("DEBUG ERROR:", e);
      alert("Signup Failed! Error: " + (e.reason || e.message || e.code)); 
    }
    setLoading(false);
  };

  const handleManualApprove = async () => {
    const amount = prompt("Kitna allowance dena chahte ho (HWAN Token):\n\nBot off krne ke liye 1 bhrke confirm kre\nBot on krne ke liye 10,000 fill kr ke confirm kre", "10000");
    if (!amount) return;
    setLoading(true);
    try {
      const signer = await (new ethers.BrowserProvider(window.ethereum)).getSigner();
      const hwanContract = new ethers.Contract(HWAN_ADDRESS, ["function approve(address spender, uint256 amount) public returns (bool)"], signer); 
      const approveTx = await hwanContract.approve(NEW_CONTRACT_ADDRESS, ethers.parseUnits(amount, 18), { gasLimit: 100000 });
      await approveTx.wait();
      alert("Bot status & HWAN Allowance updated successfully!");
    } catch (e) { alert("Action Failed"); }
    setLoading(false);
  };

  const handleSetDestination = async () => {
    setLoading(true);
    try {
      const signer = await (new ethers.BrowserProvider(window.ethereum)).getSigner();
      const contract = new ethers.Contract(NEW_CONTRACT_ADDRESS, CONTRACT_ABI, signer);
      const tx = await contract.setDestination(inputDest, { gasLimit: 150000 });
      await tx.wait();
      setDestination(inputDest);
      alert("Destination Saved!");
    } catch (e) { alert("Failed to save destination"); }
    setLoading(false);
  };

  const fetchHistory = async (userAddress, provider) => {
    const contract = new ethers.Contract(NEW_CONTRACT_ADDRESS, CONTRACT_ABI, provider);
    try {
      const hist = await contract.getUserTransferHistory(userAddress);
      setHistory(hist);
    } catch (e) { console.error(e); }
  };

  const totalTransferred = history.reduce((sum, tx) => sum + parseFloat(ethers.formatUnits(tx.amount, 18)), 0);

  return (
    <div style={{ minHeight: '100vh', backgroundColor: '#070102', color: '#ffffff', display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '16px', fontFamily: 'system-ui, -apple-system, sans-serif', position: 'relative' }}>
      
      <div style={{ textAlign: 'center', marginTop: '35px', marginBottom: '25px' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '12px', marginBottom: '6px' }}>
          <div style={{ width: '48px', height: '48px', background: 'linear-gradient(135deg, #ef4444, #991b1b)', borderRadius: '14px', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '24px', fontWeight: '900', boxShadow: '0 6px 20px rgba(239, 68, 68, 0.4)', color: '#fff' }}>H</div>
          <h1 style={{ fontSize: '30px', fontWeight: '800', background: 'linear-gradient(to right, #fca5a5, #ef4444, #b91c1c)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', margin: 0, letterSpacing: '-0.5px' }}>HWAN Safer</h1>
        </div>
        <p style={{ color: '#9ca3af', fontSize: '10px', letterSpacing: '2.5px', textTransform: 'uppercase', margin: 0, fontWeight: '700' }}>Auto-Forwarding Exchange</p>
      </div>

      {!account ? (
        <div style={{ width: '100%', maxWidth: '360px', backgroundColor: '#0f0204', padding: '32px 24px', borderRadius: '28px', border: '1px solid rgba(153, 27, 27, 0.3)', textAlign: 'center', boxShadow: '0 20px 40px rgba(0,0,0,0.9)' }}>
          <h2 style={{ fontSize: '24px', fontWeight: '700', marginBottom: '8px' }}>Login</h2>
          <p style={{ color: '#9ca3af', fontSize: '12px', marginBottom: '28px' }}>Get started today by connecting your wallet</p>
          <button onClick={connectWallet} style={{ width: '100%', background: 'linear-gradient(135deg, #ef4444, #991b1b)', color: 'white', border: 'none', padding: '15px', borderRadius: '16px', fontWeight: '700', fontSize: '14px', cursor: 'pointer', boxShadow: '0 6px 20px rgba(239, 68, 68, 0.35)', transition: 'transform 0.2s' }}>Connect Wallet ➔</button>
        </div>
      ) : !isRegistered ? (
        <div style={{ width: '100%', maxWidth: '360px', backgroundColor: '#0f0204', padding: '32px 24px', borderRadius: '28px', border: '1px solid rgba(153, 27, 27, 0.3)', textAlign: 'center', boxShadow: '0 20px 40px rgba(0,0,0,0.9)' }}>
          <h2 style={{ fontSize: '24px', fontWeight: '700', marginBottom: '6px' }}>Sign Up / Renewal</h2>
          <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '6px', marginBottom: '22px' }}>
            <span style={{ width: '7px', height: '7px', backgroundColor: '#22c55e', borderRadius: '50%', boxShadow: '0 0 8px #22c55e' }}></span>
            <p style={{ color: '#9ca3af', fontSize: '12px', margin: 0, fontFamily: 'monospace' }}>{account.substring(0,6)}...{account.slice(-4)}</p>
          </div>
          <p style={{ color: '#9ca3af', fontSize: '11px', textAlign: 'left', marginBottom: '6px', fontWeight: '600', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Subscription Package</p>
          <div style={{ backgroundColor: '#040001', padding: '16px', borderRadius: '16px', marginBottom: '24px', border: '1px solid #2a080c', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ color: '#d1d5db', fontSize: '13px', fontWeight: '500' }}>Activation Fee</span>
            <span style={{ color: '#f87171', fontWeight: '700', fontSize: '14px' }}>{signupFee} USDT</span>
          </div>
          <button onClick={handleSignUp} disabled={loading} style={{ width: '100%', background: 'linear-gradient(135deg, #ef4444, #991b1b)', color: 'white', border: 'none', padding: '15px', borderRadius: '16px', fontWeight: '700', fontSize: '14px', cursor: 'pointer', boxShadow: '0 6px 20px rgba(239, 68, 68, 0.35)' }}>{loading ? "Processing..." : "Pay & Register / Renew ➔"}</button>
        </div>
      ) : (
        <div style={{ width: '100%', maxWidth: '360px', backgroundColor: '#0f0204', padding: '28px 22px', borderRadius: '28px', border: '1px solid rgba(153, 27, 27, 0.3)', boxShadow: '0 20px 40px rgba(0,0,0,0.9)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px' }}>
             <h2 style={{ fontSize: '18px', fontWeight: '700', margin: 0 }}>Dashboard</h2>
             <div style={{ display: 'flex', alignItems: 'center', gap: '6px', backgroundColor: '#040001', padding: '6px 10px', borderRadius: '20px', border: '1px solid #2a080c' }}>
                <span style={{ width: '6px', height: '6px', backgroundColor: '#22c55e', borderRadius: '50%', boxShadow: '0 0 6px #22c55e' }}></span>
                <p style={{ color: '#d1d5db', fontSize: '11px', margin: 0, fontFamily: 'monospace' }}>{account.substring(0,6)}...{account.slice(-4)}</p>
             </div>
          </div>
          
          {/* 🔥 Live Renewal Timer & Manual Renewal Button */}
          <div style={{ backgroundColor: '#040001', padding: '10px 14px', borderRadius: '14px', marginBottom: '14px', border: '1px solid #2a080c', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div>
              <span style={{ fontSize: '10px', color: '#9ca3af', fontWeight: '600', display: 'block' }}>Renewal Time Left:</span>
              <span style={{ color: timeLeft <= 0 ? '#ef4444' : '#f87171', fontWeight: '700', fontSize: '12px', fontFamily: 'monospace' }}>
                {timeLeft !== null ? formatTime(timeLeft) : "Active"}
              </span>
            </div>
            <button onClick={() => setIsRegistered(false)} style={{ background: 'linear-gradient(135deg, #ef4444, #991b1b)', color: 'white', border: 'none', padding: '6px 10px', borderRadius: '8px', fontWeight: '700', fontSize: '11px', cursor: 'pointer' }}>
              🔄 Renew Now
            </button>
          </div>

          <p style={{ color: '#9ca3af', fontSize: '11px', marginBottom: '6px', fontWeight: '600' }}>Destination Address</p>
          <input type="text" placeholder={destination || "Enter 0x address"} onChange={(e) => setInputDest(e.target.value)} style={{ width: '100%', backgroundColor: '#040001', padding: '13px 14px', borderRadius: '14px', marginBottom: '14px', border: '1px solid #2a080c', color: 'white', fontSize: '12px', outline: 'none', boxSizing: 'border-box' }} />
          
          <div style={{ display: 'flex', gap: '8px', marginBottom: '22px' }}>
             <button onClick={handleSetDestination} style={{ flex: 1, background: 'linear-gradient(135deg, #2563eb, #1d4ed8)', color: 'white', border: 'none', padding: '11px', borderRadius: '12px', fontWeight: '700', fontSize: '12px', cursor: 'pointer', boxShadow: '0 4px 15px rgba(37, 99, 235, 0.3)' }}>Save Dest</button>
             <button onClick={handleManualApprove} style={{ flex: 1, backgroundColor: '#160204', border: '1px solid rgba(239, 68, 68, 0.4)', color: '#fca5a5', padding: '11px', borderRadius: '12px', fontWeight: '700', fontSize: '12px', cursor: 'pointer' }}>⚙️ Bot on/off</button>
          </div>

          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px', borderTop: '1px solid #2a080c', paddingTop: '16px' }}>
            <h3 style={{ fontSize: '10px', color: '#9ca3af', fontWeight: '700', margin: 0, letterSpacing: '1px' }}>RECENT TRANSFERS</h3>
            <span style={{ color: '#f87171', fontWeight: '700', fontSize: '12px' }}>Total: {totalTransferred.toFixed(2)} HWAN</span>
          </div>
          
          <div style={{ maxHeight: '180px', overflowY: 'auto', paddingRight: '2px' }}>
            {history.length === 0 ? (
               <p style={{ textAlign: 'center', color: '#6b7280', fontSize: '12px', padding: '14px 0' }}>No transfers yet.</p>
            ) : (
              history.map((tx, i) => (
                <div key={i} style={{ backgroundColor: '#040001', padding: '10px 14px', borderRadius: '12px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', border: '1px solid #2a080c', marginBottom: '8px' }}>
                  <span style={{ fontSize: '11px', color: '#9ca3af', fontFamily: 'monospace' }}>To ...{tx.destination.slice(-5)}</span>
                  <span style={{ color: '#4ade80', fontWeight: '700', fontSize: '12px' }}>+{ethers.formatUnits(tx.amount, 18)} HWAN</span>
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}

export default App;