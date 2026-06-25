
    // Theme initialization (check localStorage early to avoid flicker)
    (function initTheme() {
      const savedTheme = localStorage.getItem('theme');
      if (savedTheme === 'light') {
        document.body.classList.add('light-theme');
      } else {
        document.body.classList.remove('light-theme');
      }
    })();

    // ============== GLOBAL STATE ==============
    let globalData = {}; // Kept for compatibility with chart initialization
    let chartsInitialized = { overall: false, sales: false, executive: false };
    let loggedInUser = { name: 'User', role: 'Client', email: '' };

    // Phase 8 Global Filters
    let globalMasterData = []; // Raw records from backend
    let currentFilteredData = []; // Records after global filters
    let globalRevenueRecords = [];
    let revenueDataProcessed = false;

    // Phase 13 Executive Overview State
    let execFilteredData = [];
    let activeExecKpiFilter = null;
    let activeExecKpiFilteredRecords = [];
    let currentExecPage = 1;
    const EXEC_PAGE_SIZE = 50;

    // Phase 11: Session Management
    const SESSION_KEY = 'qm_session';
    const SESSION_TIMEOUT_MS = 12 * 60 * 60 * 1000; // 12 hours
    let sessionExpiryTimer = null;

    // Check for existing valid session on page load
    (function checkExistingSession() {
      try {
        let sessionStr = localStorage.getItem(SESSION_KEY);
        if (!sessionStr) return;
        
        let session = JSON.parse(sessionStr);
        let elapsed = Date.now() - session.loginTime;
        
        if (elapsed >= SESSION_TIMEOUT_MS) {
          // Session expired
          localStorage.removeItem(SESSION_KEY);
          return;
        }
        
        // Valid session found — auto-login
        loggedInUser.name = session.name || 'User';
        loggedInUser.role = session.role || 'Client';
        loggedInUser.email = session.email || '';
        
        // Bypass login screen
        setTimeout(function() {
          updateUserProfile();
          document.getElementById('login-view').classList.add('hidden');
          document.getElementById('dashboard-view').classList.remove('hidden');
          initSidebar();
          loadDashboardData();
          startSessionExpiryCheck();
        }, 100);
      } catch(e) {
        localStorage.removeItem(SESSION_KEY);
      }
    })();

    function startSessionExpiryCheck() {
      if (sessionExpiryTimer) clearInterval(sessionExpiryTimer);
      sessionExpiryTimer = setInterval(function() {
        let sessionStr = localStorage.getItem(SESSION_KEY);
        if (!sessionStr) { handleLogout(); return; }
        let session = JSON.parse(sessionStr);
        let elapsed = Date.now() - session.loginTime;
        if (elapsed >= SESSION_TIMEOUT_MS) {
          handleLogout();
          showToast('\u23F0 Session expired. Please login again.', 'error');
        }
      }, 60000); // Check every 60 seconds
    }

    // ============== REALTIME LOGIN INTERACTIVITY ==============
    let dnaAngle = 0;
    function drawDNA() {
      const canvas = document.getElementById('dna-canvas');
      if (!canvas) return;
      const ctx = canvas.getContext('2d');
      if (!ctx) return;
      
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      const centerX = canvas.width / 2;
      const numNodes = 14;
      const spacing = (canvas.height - 20) / numNodes;
      
      for (let i = 0; i < numNodes; i++) {
        const y = i * spacing + 10;
        const offset = i * 0.45 + dnaAngle;
        const x1 = centerX + Math.sin(offset) * (canvas.width * 0.35);
        const x2 = centerX - Math.sin(offset) * (canvas.width * 0.35);
        
        // Connecting strand line
        ctx.beginPath();
        ctx.moveTo(x1, y);
        ctx.lineTo(x2, y);
        ctx.strokeStyle = 'rgba(56, 189, 248, 0.15)';
        ctx.lineWidth = 1;
        ctx.stroke();
        
        // Glowing nodes logic
        ctx.save();
        ctx.shadowBlur = 6;
        ctx.shadowColor = '#00f0ff';
        
        ctx.beginPath();
        ctx.arc(x1, y, 4.5, 0, Math.PI * 2);
        ctx.fillStyle = Math.sin(offset) > 0 ? '#00f0ff' : '#0369a1';
        ctx.fill();
        
        ctx.beginPath();
        ctx.arc(x2, y, 4.5, 0, Math.PI * 2);
        ctx.fillStyle = Math.sin(offset) < 0 ? '#00f0ff' : '#0369a1';
        ctx.fill();
        
        ctx.restore();
      }
      
      dnaAngle += 0.025;
      requestAnimationFrame(drawDNA);
    }

    function initLoginCharts() {
      const leftCanvas = document.getElementById('login-left-chart');
      const rightCanvas = document.getElementById('login-right-chart');
      if (!leftCanvas || !rightCanvas) return;

      const ctxLeft = leftCanvas.getContext('2d');
      
      // Creating nice neon gradient for line chart
      const lineGradient = ctxLeft.createLinearGradient(0, 0, 0, leftCanvas.height);
      lineGradient.addColorStop(0, 'rgba(0, 240, 255, 0.25)');
      lineGradient.addColorStop(1, 'rgba(0, 240, 255, 0.0)');

      new Chart(ctxLeft, {
        type: 'line',
        data: {
          labels: ['00:00', '04:00', '08:00', '12:00', '16:00', '20:00'],
          datasets: [{
            data: [98.5, 99.1, 98.9, 99.4, 99.2, 99.9],
            borderColor: '#00f0ff',
            borderWidth: 1.5,
            backgroundColor: lineGradient,
            fill: true,
            tension: 0.4,
            pointRadius: 0
          }]
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          plugins: { legend: { display: false } },
          scales: {
            x: { grid: { display: false }, ticks: { display: false } },
            y: { grid: { display: false }, ticks: { display: false }, min: 95 }
          }
        }
      });

      const ctxRight = rightCanvas.getContext('2d');
      
      // Creating gradient for bar chart
      const barGradient = ctxRight.createLinearGradient(0, 0, 0, rightCanvas.height);
      barGradient.addColorStop(0, 'rgba(56, 189, 248, 0.6)');
      barGradient.addColorStop(1, 'rgba(2, 132, 199, 0.15)');

      new Chart(ctxRight, {
        type: 'bar',
        data: {
          labels: ['M', 'T', 'W', 'T', 'F'],
          datasets: [{
            data: [120, 150, 180, 220, 260],
            backgroundColor: barGradient,
            borderColor: 'rgba(56, 189, 248, 0.4)',
            borderWidth: 1,
            borderRadius: 4
          }]
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          plugins: { legend: { display: false } },
          scales: {
            x: { grid: { display: false }, ticks: { display: false } },
            y: { grid: { display: false }, ticks: { display: false } }
          }
        }
      });
    }

    // Attach focus class handlers for cybernetic glow labels
    function initFocusHandlers() {
      const inputs = document.querySelectorAll('.cyber-input');
      inputs.forEach(input => {
        const group = input.closest('.input-group');
        if (!group) return;
        
        input.addEventListener('focus', () => {
          group.classList.add('focused');
        });
        
        input.addEventListener('blur', () => {
          group.classList.remove('focused');
        });
      });
    }

    // ============== LOGIN ==============
    function handleLogin() {
      const emailInput = document.getElementById('email');
      const passInput = document.getElementById('password');
      const email = emailInput.value;
      const pass = passInput.value;
      const loginBtn = document.getElementById('login-btn-overlay');
      const lockIcon = document.getElementById('lock-icon');

      if(email && pass) {
        loginBtn.disabled = true;
        emailInput.disabled = true;
        passInput.disabled = true;
        
        const key = document.getElementById('flying-key');
        const lockCircle = document.getElementById('live-lock-circle');
        const lock = document.getElementById('live-lock');
        
        // Trigger key fly animation
        key.classList.remove('hidden');
        key.classList.add('animate-key-fly');
        
        // At 0.8s: key reaches lock and starts insertion glow
        setTimeout(function() {
          lockCircle.classList.add('glow');
        }, 800);
        
        // At 1.0s: lock opens, changes icon to open, shakes, and turns green
        setTimeout(function() {
          lock.classList.remove('fa-lock', 'text-sky-400');
          lock.classList.add('fa-lock-open', 'text-emerald-400');
          lockCircle.classList.remove('glow');
          lockCircle.classList.add('unlocked', 'rumble-effect');
          
          if (lockIcon) {
            lockIcon.classList.remove('fa-lock');
            lockIcon.classList.add('fa-lock-open', 'text-emerald-400');
          }
        }, 1000);
        
        // At 1.5s: hide key flyer, clean rumble, and activate button spinner
        setTimeout(function() {
          key.classList.add('hidden');
          key.classList.remove('animate-key-fly');
          lockCircle.classList.remove('rumble-effect');
          
          // Disable overlay and show loader directly on the button instead of a giant center screen
          loginBtn.innerHTML = '<i class="fa-solid fa-spinner fa-spin mr-2"></i> Authenticating...';
          
          // Check if Google Apps Script environment is active
          if (typeof google !== 'undefined' && google.script && google.script.run) {
            google.script.run
              .withSuccessHandler(function(response) {
                if(response.success) {
                  // Store user info globally
                  loggedInUser.name = response.name || 'User';
                  loggedInUser.role = response.role || 'Client';
                  loggedInUser.email = email;
                  updateUserProfile();

                  // Save session to localStorage
                  localStorage.setItem(SESSION_KEY, JSON.stringify({
                    name: loggedInUser.name,
                    role: loggedInUser.role,
                    email: loggedInUser.email,
                    loginTime: Date.now()
                  }));
                  startSessionExpiryCheck();

                  setTimeout(() => {
                    document.getElementById('login-view').style.opacity = '0';
                    setTimeout(() => {
                      document.getElementById('login-view').classList.add('hidden');
                      document.getElementById('dashboard-view').classList.remove('hidden');
                      initSidebar();
                      loadDashboardData();
                      
                      // Reset inputs
                      emailInput.value = '';
                      passInput.value = '';
                      emailInput.disabled = false;
                      passInput.disabled = false;
                      
                      // Reset lock status for next login/logout cycles
                      lock.classList.remove('fa-lock-open', 'text-emerald-400');
                      lock.classList.add('fa-lock');
                      lockCircle.classList.remove('unlocked');
                      if (lockIcon) {
                        lockIcon.classList.remove('fa-lock-open', 'text-emerald-400');
                        lockIcon.classList.add('fa-lock');
                      }
                      
                      document.getElementById('login-view').style.opacity = '1';
                      loginBtn.innerHTML = '<i class="fa-solid fa-shield-halved"></i> Initialize Access';
                      loginBtn.disabled = false;
                    }, 300);
                  }, 600);
                } else {
                  showToast('\u274C ' + response.message, 'error');
                  
                  // Reset lock state and inputs for retry
                  lock.classList.remove('fa-lock-open', 'text-emerald-400');
                  lock.classList.add('fa-lock');
                  lockCircle.classList.remove('unlocked');
                  if (lockIcon) {
                    lockIcon.classList.remove('fa-lock-open', 'text-emerald-400');
                    lockIcon.classList.add('fa-lock');
                  }
                  
                  emailInput.disabled = false;
                  passInput.disabled = false;
                  loginBtn.innerHTML = '<i class="fa-solid fa-shield-halved"></i> Initialize Access';
                  loginBtn.disabled = false;
                }
              })
              .withFailureHandler(function(error) {
                showToast('\u274C System Error: ' + error.message, 'error');
                
                // Reset lock state and inputs for retry
                lock.classList.remove('fa-lock-open', 'text-emerald-400');
                lock.classList.add('fa-lock');
                lockCircle.classList.remove('unlocked');
                if (lockIcon) {
                  lockIcon.classList.remove('fa-lock-open', 'text-emerald-400');
                  lockIcon.classList.add('fa-lock');
                }
                
                emailInput.disabled = false;
                passInput.disabled = false;
                loginBtn.innerHTML = '<i class="fa-solid fa-shield-halved"></i> Initialize Access';
                loginBtn.disabled = false;
              })
              .verifyLoginUser(email, pass);
          } else {
            // Local fallback simulation for desktop browser testing
            console.warn("Google Apps Script context not found. Executing offline gateway simulation.");
            setTimeout(function() {
              const normalizedEmail = email.trim().toLowerCase();
              if (normalizedEmail === 'admin@redcliffe.com' || normalizedEmail === 'user@redcliffe.com') {
                loggedInUser.name = 'Administrator';
                loggedInUser.role = 'Admin';
                loggedInUser.email = email;
                updateUserProfile();

                localStorage.setItem(SESSION_KEY, JSON.stringify({
                  name: loggedInUser.name,
                  role: loggedInUser.role,
                  email: loggedInUser.email,
                  loginTime: Date.now()
                }));
                startSessionExpiryCheck();

                setTimeout(() => {
                  document.getElementById('login-view').style.opacity = '0';
                  setTimeout(() => {
                    document.getElementById('login-view').classList.add('hidden');
                    document.getElementById('dashboard-view').classList.remove('hidden');
                    initSidebar();
                    loadDashboardData();
                    
                    emailInput.value = '';
                    passInput.value = '';
                    emailInput.disabled = false;
                    passInput.disabled = false;
                    
                    lock.classList.remove('fa-lock-open', 'text-emerald-400');
                    lock.classList.add('fa-lock');
                    lockCircle.classList.remove('unlocked');
                    
                    document.getElementById('login-view').style.opacity = '1';
                    loginBtn.innerHTML = '<i class="fa-solid fa-shield-halved"></i> Initialize Access';
                    loginBtn.disabled = false;
                  }, 300);
                }, 600);
              } else {
                showToast('\u274C Invalid Access Code or Email! (Offline Simulation)', 'error');
                lock.classList.remove('fa-lock-open', 'text-emerald-400');
                lock.classList.add('fa-lock');
                lockCircle.classList.remove('unlocked');
                
                emailInput.disabled = false;
                passInput.disabled = false;
                loginBtn.innerHTML = '<i class="fa-solid fa-shield-halved"></i> Initialize Access';
                loginBtn.disabled = false;
              }
            }, 1200);
          }
        }, 1500);
      } else {
        showToast('\u274C Please provide both Authorized Email and Access Code.', 'error');
      }
    }

    // Start DNA and Login Charts on load
    window.addEventListener('DOMContentLoaded', function() {
      const dnaCanvas = document.getElementById('dna-canvas');
      if (dnaCanvas) {
        dnaCanvas.width = 144;
        dnaCanvas.height = 192;
        drawDNA();
      }
      initLoginCharts();
      initFocusHandlers();
    });

    function handleLogout() {
      localStorage.removeItem(SESSION_KEY);
      if (sessionExpiryTimer) clearInterval(sessionExpiryTimer);
      document.getElementById('dashboard-view').classList.add('hidden');
      document.getElementById('login-view').classList.remove('hidden');
      loggedInUser = { name: 'User', role: 'Client', email: '' };
      chartsInitialized = { overall: false, sales: false, executive: false };
      revenueDataProcessed = false;
      globalRevenueRecords = [];
      
      // Invalidate caches
      cachedDropdownData = null;
      cachedLeadTableRows = null;
      formDropdownsLoaded = false;
    }

    // ============== FORGOT PASSWORD OTP FLOW (PHASE 12) ==============
    function showForgotPassword() {
      // Clear inputs
      document.getElementById('forgot-email').value = '';
      document.getElementById('otp-input').value = '';
      document.getElementById('new-password').value = '';
      
      // Pre-fill email if entered in login screen
      let loginEmail = document.getElementById('email').value.trim();
      if (loginEmail) {
        document.getElementById('forgot-email').value = loginEmail;
      }
      
      document.getElementById('forgot-step1').classList.remove('hidden');
      document.getElementById('forgot-step2').classList.add('hidden');
      document.getElementById('forgot-step3').classList.add('hidden');
      
      // Open modal
      document.getElementById('forgot-modal').classList.remove('hidden');
    }

    function closeForgotModal() {
      document.getElementById('forgot-modal').classList.add('hidden');
    }

    function handleSendOTP() {
      let email = document.getElementById('forgot-email').value.trim();
      if (!email) { 
        showToast('\u274C Please enter your registered email address.', 'error');
        return; 
      }
      
      // Frontend Email Format Check
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(email)) {
        showToast('\u274C Please enter a valid email address format (e.g. user@example.com).', 'error');
        return;
      }

      let btn = document.getElementById('send-otp-btn');
      btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Sending OTP...';
      btn.disabled = true;

      google.script.run
        .withSuccessHandler(function(res) {
          btn.innerHTML = '<i class="fa-solid fa-paper-plane"></i> <span>Send OTP</span>';
          btn.disabled = false;
          if (res.success) {
            showToast('\u2705 OTP sent successfully to your email!', 'success');
            // Move to Step 2
            document.getElementById('forgot-step1').classList.add('hidden');
            document.getElementById('forgot-step2').classList.remove('hidden');
            document.getElementById('otp-email-display').innerText = email;
          } else {
            showToast('\u274C ' + res.message, 'error');
          }
        })
        .withFailureHandler(function(err) {
          btn.innerHTML = '<i class="fa-solid fa-paper-plane"></i> <span>Send OTP</span>';
          btn.disabled = false;
          showToast('\u274C Error: ' + err.message, 'error');
        })
        .sendOTP(email);
    }

    function handleVerifyOTP() {
      let email = document.getElementById('forgot-email').value.trim();
      let otp = document.getElementById('otp-input').value.trim();
      let newPass = document.getElementById('new-password').value.trim();

      if (!otp || otp.length !== 6 || isNaN(otp)) { 
        showToast('\u274C Please enter a valid 6-digit OTP.', 'error'); 
        return; 
      }
      if (!newPass || newPass.length < 3) { 
        showToast('\u274C Password must be at least 3 characters.', 'error'); 
        return; 
      }

      let btn = document.getElementById('verify-otp-btn');
      btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Verifying...';
      btn.disabled = true;

      google.script.run
        .withSuccessHandler(function(res) {
          btn.innerHTML = '<i class="fa-solid fa-check-double"></i> <span>Verify & Update Password</span>';
          btn.disabled = false;
          if (res.success) {
            showToast('\uD83C\uDF89 Password reset successful!', 'success');
            // Move to Step 3 — Success
            document.getElementById('forgot-step2').classList.add('hidden');
            document.getElementById('forgot-step3').classList.remove('hidden');
            
            // Auto fill the login page email field
            document.getElementById('email').value = email;
            document.getElementById('password').value = '';
          } else {
            showToast('\u274C ' + res.message, 'error');
          }
        })
        .withFailureHandler(function(err) {
          btn.innerHTML = '<i class="fa-solid fa-check-double"></i> <span>Verify & Update Password</span>';
          btn.disabled = false;
          showToast('\u274C Error: ' + err.message, 'error');
        })
        .verifyOTPAndResetPassword(email, otp, newPass);
    }

    // ============== USER PROFILE UPDATE ==============
    function updateUserProfile() {
      const initials = loggedInUser.name.split(' ').map(n => n[0]).join('').toUpperCase().substring(0, 2);
      document.getElementById('user-avatar').innerText = initials;
      document.getElementById('user-name-display').innerText = loggedInUser.name;
      document.getElementById('user-role-display').innerText = loggedInUser.role + ' Portal';
      
      // Update theme icon on load based on saved preference
      const savedTheme = localStorage.getItem('theme');
      const icon = document.getElementById('theme-toggle-icon');
      if (icon) {
        if (savedTheme === 'light') {
          icon.className = 'fa-solid fa-sun text-sm';
        } else {
          icon.className = 'fa-solid fa-moon text-sm';
        }
      }
    }

    // ============== SIDEBAR TOGGLE (ALL SCREENS) ==============
    let sidebarOpen = false;

    function toggleSidebar() {
      const sidebar = document.getElementById('sidebar');
      const overlay = document.getElementById('sidebar-overlay');
      const main = document.getElementById('main-content');

      sidebarOpen = !sidebarOpen;

      if (sidebarOpen) {
        sidebar.classList.remove('-translate-x-full');
        sidebar.classList.add('translate-x-0');
        overlay.classList.remove('hidden');
        // On desktop, push main content right
        if (window.innerWidth >= 768) {
          main.style.marginLeft = '288px'; // w-72 = 18rem = 288px
        }
      } else {
        sidebar.classList.add('-translate-x-full');
        sidebar.classList.remove('translate-x-0');
        overlay.classList.add('hidden');
        main.style.marginLeft = '0';
      }
    }

    // Auto-open sidebar on desktop after login
    function initSidebar() {
      if (window.innerWidth >= 768) {
        sidebarOpen = true;
        const sidebar = document.getElementById('sidebar');
        const main = document.getElementById('main-content');
        sidebar.classList.remove('-translate-x-full');
        sidebar.classList.add('translate-x-0');
        main.style.marginLeft = '288px';
      }
    }
    function toggleDarkMode() {
      const isLight = document.body.classList.contains('light-theme');
      if (isLight) {
        document.body.classList.remove('light-theme');
        localStorage.setItem('theme', 'dark');
        const icon = document.getElementById('theme-toggle-icon');
        if (icon) {
          icon.className = 'fa-solid fa-moon text-sm';
        }
      } else {
        document.body.classList.add('light-theme');
        localStorage.setItem('theme', 'light');
        const icon = document.getElementById('theme-toggle-icon');
        if (icon) {
          icon.className = 'fa-solid fa-sun text-sm';
        }
      }
      
      // Update Chart defaults
      const isThemeLight = document.body.classList.contains('light-theme');
      Chart.defaults.color = isThemeLight ? '#475569' : '#64748b';

      // Rebuild initialized charts
      if (chartsInitialized.overall) {
        initOverallCharts();
      }
      if (chartsInitialized.sales && typeof renderDynamicRevenueChart === 'function') {
        renderDynamicRevenueChart();
      }
      if (chartsInitialized.executive) {
        initExecutiveCharts();
      }
    }

    // ============== SYNC DATA BUTTON ==============
    function syncDashboard() {
      const icon = document.getElementById('sync-icon');
      if (icon) icon.classList.add('fa-spin');
      
      // Invalidate caches to guarantee fresh sync fetches
      cachedDropdownData = null;
      cachedLeadTableRows = null;
      formDropdownsLoaded = false;
      chartsInitialized = { overall: false, sales: false, executive: false };

      // Reload everything
      loadDashboardData();
      loadLeadTable();

      // Stop spin after delay and show toast
      setTimeout(() => {
        if (icon) icon.classList.remove('fa-spin');
        updateLastSynced();
        showToast('\uD83D\uDD04 Dashboard synced successfully', 'success');
      }, 2000);
    }

    // ============== TAB NAVIGATION ==============
    function switchTab(tabName) {
      // Close active KPI detail popups on navigation
      if (typeof closeKpiDetailModal === 'function') closeKpiDetailModal();
      if (typeof closeExecKpiDetailModal === 'function') closeExecKpiDetailModal();

      // Hide all tabs
      ['tab-overall', 'tab-sales', 'tab-executive', 'tab-form'].forEach(id => {
        const el = document.getElementById(id);
        if (el) el.classList.add('hidden');
      });

      // Reset all nav links
      document.querySelectorAll('.nav-link').forEach(link => {
        link.className = 'nav-link flex items-center space-x-3 text-slate-300 hover:text-white hover:bg-slate-800/40 p-3 rounded-xl transition-all';
        link.querySelector('i').classList.remove('text-sky-400', 'text-glow');
        link.querySelector('i').classList.add('text-sky-500');
        link.querySelector('span').classList.remove('text-glow');
      });

      // Show selected tab
      document.getElementById('tab-' + tabName).classList.remove('hidden');
      
      // Highlight active nav
      const activeNav = document.getElementById('nav-' + tabName);
      if (activeNav) {
        activeNav.className = 'nav-link flex items-center space-x-3 text-white bg-sky-900/20 border border-sky-500/30 p-3 rounded-xl shadow-[0_0_15px_rgba(2,132,199,0.15)]';
        activeNav.querySelector('i').classList.remove('text-sky-500');
        activeNav.querySelector('i').classList.add('text-sky-400', 'text-glow');
        activeNav.querySelector('span').classList.add('text-glow');
      }

      // Update header title
      const titles = {
        overall: 'Overall <span class="font-bold text-sky-500">Summary</span>',
        sales: 'Sales Intelligence <span class="font-bold text-sky-500">Core</span>',
        executive: 'Executive <span class="font-bold text-sky-500">Overview</span>',
        form: 'QuoteMaster <span class="font-bold text-sky-500">Form</span>'
      };
      document.getElementById('page-title').innerHTML = titles[tabName] || '';

      // Initialize charts for tab if data is loaded
      if (globalData.kpis) {
        if (tabName === 'overall' && !chartsInitialized.overall) initOverallCharts();
        if (tabName === 'sales' && !chartsInitialized.sales) initSalesCharts();
        if (tabName === 'executive' && !chartsInitialized.executive) initExecutiveCharts();
      }

      // Load form data when form tab is selected
      if (tabName === 'form') {
        loadFormData();
        loadLeadTable();
        // Populate mini KPIs from filtered data (respects AM login)
        if (currentFilteredData && currentFilteredData.length > 0) {
          let fData = currentFilteredData;
          let fWon = fData.filter(r => {
            let d = (r.dealStatus || '').toLowerCase();
            return d === 'won' || d === 'closed' || d === 'done' || d === 'launched';
          }).length;
          let fPending = fData.filter(r => {
            let d = (r.dealStatus || '').toLowerCase();
            let isWon = ["won", "closed", "done", "launched"].includes(d);
            let isLost = ["deal lost", "lost", "dropped", "cancelled"].includes(d);
            return !isWon && !isLost;
          }).length;
          document.getElementById('form-kpi-leads').innerText = fData.length;
          document.getElementById('form-kpi-pending').innerText = fPending;
          document.getElementById('form-kpi-won').innerText = fWon;
        } else if (globalData.kpis) {
          document.getElementById('form-kpi-leads').innerText = globalData.kpis.totalQuotes || 0;
          document.getElementById('form-kpi-pending').innerText = globalData.kpis.pendingQuotes || 0;
          document.getElementById('form-kpi-won').innerText = globalData.kpis.dealsClosed || 0;
        }
      }

      // Close sidebar on mobile after tab switch
      if (window.innerWidth < 768) {
        const sidebar = document.getElementById('sidebar');
        if (!sidebar.classList.contains('-translate-x-full')) {
          toggleSidebar();
        }
      }
    }

    // ============== PHASE 8: FETCH RAW DATA & GLOBAL FILTERS ==============
    // Caches for Form Dropdowns and Lead Table Rows (PHASE 12)
    let cachedDropdownData = null;
    let cachedLeadTableRows = null;
    let cachedLeadTableTotal = 0;
    
    // KPI Detail Filter state
    let activeKpiFilter = null;
    let activeKpiFilteredRecords = [];

    // Helper for case-insensitive, trimmed, and substring matching of AM names
    function isAmMatch(recordAm, userAm) {
      if (!recordAm || !userAm) return false;
      let r = recordAm.toString().toLowerCase().trim();
      let u = userAm.toString().toLowerCase().trim();
      return r === u || r.includes(u) || u.includes(r);
    }

    function formatStatusForDisplay(status) {
      if (!status) return 'Pending';
      return status.toString().split(' ').map(w => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase()).join(' ');
    }

    // ============== PHASE 12: KPI DETAIL POPUP & INTERACTIVE SYSTEM GUIDE ==============
    function toggleKpiFilter(kpiLabel, dataKey) {
        if (activeKpiFilter === dataKey) {
          closeKpiDetailModal();
          return;
        }
        
        activeKpiFilter = dataKey;
        
        let matched = [];
        let subtitle = "";
        if (dataKey === 'totalQuotes') {
          matched = currentFilteredData;
          subtitle = "All generated quotes";
        } else if (dataKey === 'dealsClosed') {
          matched = currentFilteredData.filter(r => r.quoteStatus === 'Deal Won');
          subtitle = "Successful conversion deals";
        } else if (dataKey === 'pendingQuotes') {
          matched = currentFilteredData.filter(r => r.quoteStatus !== 'Deal Won');
          subtitle = "Quotes currently under negotiation";
        } else if (dataKey === 'dealsLost') {
          matched = currentFilteredData.filter(r => {
            let d = r.quoteStatus ? r.quoteStatus.toLowerCase().trim() : '';
            return d === 'deal lost' || d === 'lost' || d === 'dropped' || d === 'cancelled' || d === 'closed - lost';
          });
          subtitle = "Dropped or cancelled deals";
        }
        
        activeKpiFilteredRecords = matched;
        
        resetAllKpiCardStyles();
        
        // Highlight clicked card
        const cardIdMap = {
          'totalQuotes': 'card-total-quotes',
          'dealsClosed': 'card-conv-rate',
          'pendingQuotes': 'card-in-negotiation',
          'dealsLost': 'card-loss-rate'
        };
        const cardId = cardIdMap[dataKey];
        const cardEl = document.getElementById(cardId);
        if (cardEl) {
          cardEl.classList.remove('border-x-slate-700/50', 'border-b-slate-700/50');
          cardEl.classList.add('border-sky-400', 'shadow-[0_0_25px_rgba(56,189,248,0.35)]');
        }
        
        // Update line chart trend dynamically to reflect clicked metric
        updateDynamicCharts(kpiLabel, dataKey);
        
        buildActiveDealRegistry();
      }

      function closeKpiDetailModal() {
        activeKpiFilter = null;
        activeKpiFilteredRecords = [];
        resetAllKpiCardStyles();
        
        // Reset dynamic charts
        updateDynamicCharts('Total Pipeline', 'totalQuotes');
        
        buildActiveDealRegistry();
      }
      
      function resetAllKpiCardStyles() {
      const cardTotal = document.getElementById('card-total-quotes');
      const cardConv = document.getElementById('card-conv-rate');
      const cardNegotiation = document.getElementById('card-in-negotiation');
      const cardLoss = document.getElementById('card-loss-rate');
      
      if (cardTotal) {
        cardTotal.className = "premium-glass kpi-card p-5 rounded-2xl cursor-pointer border-t-2 border-sky-500 border-x border-b border-x-slate-700/50 border-b-slate-700/50 hover:border-x-sky-500/50 hover:border-b-sky-500/50 transition-all duration-300 hover:shadow-[0_0_25px_rgba(56,189,248,0.15)]";
      }
      if (cardConv) {
        cardConv.className = "premium-glass kpi-card p-5 rounded-2xl cursor-pointer border-t-2 border-emerald-500 border-x border-b border-x-slate-700/50 border-b-slate-700/50 hover:border-x-emerald-500/50 hover:border-b-emerald-500/50 transition-all duration-300 hover:shadow-[0_0_25px_rgba(52,211,153,0.15)]";
      }
      if (cardNegotiation) {
        cardNegotiation.className = "premium-glass kpi-card p-5 rounded-2xl cursor-pointer border-t-2 border-amber-500 border-x border-b border-x-slate-700/50 border-b-slate-700/50 hover:border-x-amber-500/50 hover:border-b-amber-500/50 transition-all duration-300 hover:shadow-[0_0_25px_rgba(251,191,36,0.15)]";
      }
      if (cardLoss) {
        cardLoss.className = "premium-glass kpi-card p-5 rounded-2xl cursor-pointer border-t-2 border-rose-500 border-x border-b border-x-slate-700/50 border-b-slate-700/50 hover:border-x-rose-500/50 hover:border-b-rose-500/50 transition-all duration-300 hover:shadow-[0_0_25px_rgba(244,63,94,0.15)]";
      }
    }

    function renderKpiDetailTable(records) {
      const tbody = document.getElementById('kpi-detail-table-body');
      if (!tbody) return;
      
      let html = '';
      records.forEach(r => {
        let revFormatted = r.revenue ? '₹' + r.revenue.toLocaleString('en-IN') : '—';
        html += '<tr class="border-b border-slate-800/30 hover:bg-slate-800/20 transition-colors">';
        html += '<td class="py-3 px-3 text-sky-400 font-mono text-xs font-bold">' + (r.quoteCode || '—') + '</td>';
        html += '<td class="py-3 px-3 text-white font-medium truncate max-w-[180px]">' + (r.clientName || '—') + '</td>';
        html += '<td class="py-3 px-3 text-xs">' + getStatusBadge(r.quoteStatus) + '</td>';
        html += '<td class="py-3 px-3 text-slate-400 text-xs">' + (r.type || '—') + '</td>';
        html += '<td class="py-3 px-3 text-slate-300 text-xs">' + (r.amName || '—') + '</td>';
        html += '<td class="py-3 px-3 text-right text-emerald-400 font-bold">' + revFormatted + '</td>';
        html += '</tr>';
      });
      
      if (html === '') {
        html = '<tr><td colspan="6" class="text-center text-slate-500 py-8">No matching records found</td></tr>';
      }
      tbody.innerHTML = html;
    }

    function filterKpiDetailTable() {
      const searchVal = document.getElementById('kpi-detail-search').value.toLowerCase().trim();
      let filtered = activeKpiFilteredRecords;
      if (searchVal) {
        filtered = activeKpiFilteredRecords.filter(r => {
          let combined = [r.quoteCode, r.clientName, r.quoteStatus, r.type, r.amName].join(' ').toLowerCase();
          return combined.includes(searchVal);
        });
      }
      document.getElementById('kpi-detail-count').innerText = filtered.length + ' records matching';
      renderKpiDetailTable(filtered);
    }

    function openGuideModal() {
      document.getElementById('guide-modal').classList.remove('hidden');
    }

    function closeGuideModal() {
      document.getElementById('guide-modal').classList.add('hidden');
    }

    // ============== COMBINED DATA LOAD (PHASE 12 OPTIMIZATION) ==============
    function loadDashboardData() {
      // Set loading spinners for all KPI elements
      ['kpi-total-quotes', 'kpi-conv-rate', 'kpi-pending', 'kpi-loss-rate', 'kpi-top-performer',
       'kpi-deals-won', 'kpi-deals-lost', 'kpi-deals-pending', 'kpi-top-channel',
       'exec-kpi-pipeline', 'exec-kpi-top-client', 'exec-kpi-active-clients', 'exec-kpi-package-count',
       'kpi-rev-total', 'kpi-rev-packages'].forEach(id => {
        const el = document.getElementById(id);
        if (el) el.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i>';
      });

      google.script.run
        .withSuccessHandler(function(response) {
          if (response.success) {
            // 1. Process Quote Master Data
            globalMasterData = response.quoteMasterRecords || [];
            setupFilters();
            applyGlobalFilters();
            setupExecFilters();
            applyExecFilters();
            
            // 2. Process Revenue Data
            globalRevenueRecords = response.revenueRecords || [];
            revenueDataProcessed = true;
            setupSalesFilters();
            applySalesFilters();
            
            // 3. Cache and Eagerly Populate Dropdowns
            if (response.dropdownData) {
              cachedDropdownData = response.dropdownData;
              formDropdownsLoaded = true;
              populateFormDropdowns(response.dropdownData);
            }
            
            // 4. Cache and Populate Lead Table
            if (response.leadTableData) {
              cachedLeadTableRows = response.leadTableData.rows || [];
              cachedLeadTableTotal = response.leadTableData.total || 0;
              buildLeadTable(cachedLeadTableRows);
            }
          } else {
            console.error("Dashboard Combined Loading Error:", response.error);
            showToast("\u274C Database Error: " + response.error, "error");
          }
        })
        .withFailureHandler(function(error) {
          console.error("Dashboard Combined Network Error:", error);
          showToast("\u274C Network Error: Could not load data", "error");
        })
        .getCombinedDashboardData();
    }

    function loadRevenueData() {
      // Stub function since data is loaded in combined call
      if (revenueDataProcessed) {
        processRevenueKPIs();
      }
    }

    // ============== SALES INTELLIGENCE DYNAMIC FILTERING (PHASE 12) ==============
    let salesFilteredRecords = [];
    
    function populateMultiSelect(containerId, options, prefix, labelAll) {
      const div = document.getElementById(containerId);
      if(!div) return;
      let html = `
        <label class="flex items-center gap-2 p-2 hover:bg-slate-700 rounded cursor-pointer transition-colors">
          <input type="checkbox" id="${prefix}-all" checked onchange="toggleAllCheckboxes('${prefix}', '${labelAll}')" class="rounded border-slate-600 text-sky-500 bg-slate-900 focus:ring-0">
          <span class="text-sm text-white">${labelAll}</span>
        </label>
      `;
      options.forEach(opt => {
        let val = opt.value || opt;
        let label = opt.label || opt;
        html += `
          <label class="flex items-center gap-2 p-2 hover:bg-slate-700 rounded cursor-pointer transition-colors">
            <input type="checkbox" value="${val}" onchange="handleCbChange('${prefix}', '${labelAll}')" class="${prefix}-cb rounded border-slate-600 text-sky-500 bg-slate-900 focus:ring-0">
            <span class="text-sm text-white">${label}</span>
          </label>
        `;
      });
      div.innerHTML = html;
    }

    function setupSalesFilters() {
      if (!globalRevenueRecords || globalRevenueRecords.length === 0) return;
      
      const amSel = document.getElementById('sales-am-filter');
      if (!amSel) return;

      let uniqueMonths = [...new Set(globalRevenueRecords.map(r => r.month_date).filter(m => m && m !== 'Unknown'))];
      let uniqueAMs = [...new Set(globalRevenueRecords.map(r => r.amName).filter(am => am && am !== 'Unassigned'))].sort();
      let uniqueSources = [...new Set(globalRevenueRecords.map(r => r.sourcetype).filter(s => s && s !== 'Unknown'))].sort();

      // Populate Month dropdown
      let monthOpts = uniqueMonths.map(m => {
        let displayMonth = m;
        let d = new Date(m);
        if (!isNaN(d.getTime())) {
          const monthNames = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
          displayMonth = monthNames[d.getMonth()] + ' ' + d.getFullYear();
        }
        return { value: m, label: displayMonth };
      });
      populateMultiSelect('sales-month-options', monthOpts, 'sales-month', 'All Months');

      // Populate AM dropdown (Lock if not Admin)
      amSel.innerHTML = '<option value="All" class="bg-slate-800">All Account Managers</option>';
      if (loggedInUser.role && loggedInUser.role !== 'Admin') {
        amSel.innerHTML = `<option value="${loggedInUser.name}" class="bg-slate-800">${loggedInUser.name}</option>`;
        amSel.value = loggedInUser.name;
        amSel.disabled = true;
        amSel.classList.add("opacity-50", "cursor-not-allowed");
      } else {
        amSel.disabled = false;
        amSel.classList.remove("opacity-50", "cursor-not-allowed");
        uniqueAMs.forEach(am => {
          amSel.innerHTML += `<option value="${am}" class="bg-slate-800">${am}</option>`;
        });
      }

      // Populate Source dropdown
      populateMultiSelect('sales-source-options', uniqueSources, 'sales-source', 'All Sources');

      // Populate Center dropdown based on initial AM
      setupSalesCenterDropdown();
    }
    
    function handleSalesAMChange() {
      setupSalesCenterDropdown();
      applySalesFilters();
    }
    
    function setupSalesCenterDropdown() {
      const amSel = document.getElementById('sales-am-filter');
      const selectedAM = amSel ? amSel.value : "All";
      
      let filteredRecords = globalRevenueRecords || [];
      if (selectedAM !== "All") {
        filteredRecords = filteredRecords.filter(r => isAmMatch(r.amName, selectedAM));
      }
      
      let uniqueCenters = [...new Set(filteredRecords.map(r => r.center_name).filter(c => c && c !== 'Unknown'))].sort();
      populateMultiSelect('sales-center-options', uniqueCenters, 'sales-center', 'All Centers');
      updateFilterText('sales-center', 'All Centers');

    }

    function applySalesFilters() {
      if (!globalRevenueRecords) return;
      
      const monthAllCb = document.getElementById('sales-month-all');
      let selectedMonths = [];
      if (!monthAllCb || !monthAllCb.checked) {
        selectedMonths = Array.from(document.querySelectorAll('.sales-month-cb')).filter(cb => cb.checked).map(cb => cb.value);
      }

      const sourceAllCb = document.getElementById('sales-source-all');
      let selectedSources = [];
      if (!sourceAllCb || !sourceAllCb.checked) {
        selectedSources = Array.from(document.querySelectorAll('.sales-source-cb')).filter(cb => cb.checked).map(cb => cb.value);
      }

      const centerAllCb = document.getElementById('sales-center-all');
      let selectedCenters = [];
      if (!centerAllCb || !centerAllCb.checked) {
        selectedCenters = Array.from(document.querySelectorAll('.sales-center-cb')).filter(cb => cb.checked).map(cb => cb.value);
      }

      let selectedAM = document.getElementById('sales-am-filter') ? document.getElementById('sales-am-filter').value : 'All';

      salesFilteredRecords = globalRevenueRecords.filter(r => {
        let monthMatch = true;
        if (monthAllCb && !monthAllCb.checked) {
          monthMatch = selectedMonths.length > 0 ? selectedMonths.includes(r.month_date) : true;
        }

        let amMatch = (selectedAM === "All") || isAmMatch(r.amName, selectedAM);

        let sourceMatch = true;
        if (sourceAllCb && !sourceAllCb.checked) {
          sourceMatch = selectedSources.length > 0 ? selectedSources.includes(r.sourcetype) : true;
        }

        let centerMatch = true;
        if (centerAllCb && !centerAllCb.checked) {
          centerMatch = selectedCenters.length > 0 ? selectedCenters.includes(r.center_name) : true;
        }
        
        // Also force AM login restriction in all cases
        if (loggedInUser.role && loggedInUser.role !== 'Admin') {
          if (!isAmMatch(r.amName, loggedInUser.name)) {
            return false;
          }
        }
        
        return monthMatch && amMatch && sourceMatch && centerMatch;
      });

      processRevenueKPIs();
    }

    function clearSalesFilters() {
      ['sales-month', 'sales-source', 'sales-center'].forEach(prefix => {
        const allCb = document.getElementById(prefix + '-all');
        if (allCb) {
          allCb.checked = true;
          document.querySelectorAll('.' + prefix + '-cb').forEach(cb => cb.checked = false);
          
          let labelAll = "All Months";
          if(prefix === 'sales-source') labelAll = "All Sources";
          if(prefix === 'sales-center') labelAll = "All Centers";
          updateFilterText(prefix, labelAll);
        }
      });

      if (loggedInUser.role === 'Admin') {
        let amSel = document.getElementById('sales-am-filter');
        if(amSel) amSel.value = 'All';
      }
      setupSalesCenterDropdown(); // Reset centers based on 'All' AM
      applySalesFilters();
      showToast('Filters cleared for Sales Intelligence', 'success');
    }

    let revKpisCache = {};
    function processRevenueKPIs() {
      // Use filtered records if available, else fallback to global revenue records
      let recordsToProcess = salesFilteredRecords.length > 0 ? salesFilteredRecords : globalRevenueRecords;
      
      // If AM is logged in, ensure we filter out other AM's records even if filters haven't run
      if (loggedInUser.role && loggedInUser.role !== 'Admin') {
        recordsToProcess = recordsToProcess.filter(r => 
          isAmMatch(r.amName, loggedInUser.name)
        );
      }

      let totalRev = 0;
      let uniquePackages = new Set();
      let sourceCounts = {};
      let centerRev = {};
      let monthRev = {};
      let packageCounts = {};
      let amRev = {};
      let packageRev = {};
      let sourceRev = {};

      recordsToProcess.forEach(r => {
        let val = r.prevenue || 0;
        totalRev += val;
        
        if (r.package_code) {
          uniquePackages.add(r.package_code);
          packageCounts[r.package_code] = (packageCounts[r.package_code] || 0) + 1;
          packageRev[r.package_code] = (packageRev[r.package_code] || 0) + val;
        }
        
        let src = (r.sourcetype && r.sourcetype.trim() !== '') ? r.sourcetype.trim() : 'Other';
        sourceCounts[src] = (sourceCounts[src] || 0) + 1;
        sourceRev[src] = (sourceRev[src] || 0) + val;
        
        let ctr = (r.center_name && r.center_name.trim() !== '') ? r.center_name.trim() : 'Unknown';
        centerRev[ctr] = (centerRev[ctr] || 0) + val;
        
        let am = (r.amName && r.amName.trim() !== '') ? r.amName.trim() : 'Unassigned';
        amRev[am] = (amRev[am] || 0) + val;

        let mRaw = r.month_date || '';
        let m = 'Unknown';
        if (mRaw && mRaw !== 'Unknown') {
          let d = new Date(mRaw);
          if (!isNaN(d.getTime())) {
            const monthNames = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
            m = monthNames[d.getMonth()] + ' ' + d.getFullYear();
          } else {
            m = mRaw;
          }
        }
        if (m !== 'Unknown') {
          monthRev[m] = (monthRev[m] || 0) + val;
        }
      });

      let topSource = "N/A", maxSrc = 0;
      for (let s in sourceCounts) { if (sourceCounts[s] > maxSrc) { maxSrc = sourceCounts[s]; topSource = s; } }

      let topCenter = "N/A", maxCtr = 0;
      for (let c in centerRev) { if (centerRev[c] > maxCtr) { maxCtr = centerRev[c]; topCenter = c; } }

      // Save arrays to cache for dynamic charting
      revKpisCache = { 
        monthRev, 
        packageCounts, 
        packageRev,
        sourceCounts, 
        sourceRev,
        centerRev,
        amRev,
        records: recordsToProcess
      };

      animateCounter("kpi-rev-total", totalRev, 900, '₹');
      animateCounter("kpi-rev-packages", uniquePackages.size, 600);
      document.getElementById("kpi-rev-source").innerText = topSource;
      document.getElementById("kpi-rev-center").innerText = topCenter;

      // Update current dynamic chart visual options
      renderDynamicRevenueChart();
    }

    // Handles visual options and Group By / Metric selections (PHASE 12)
    function onRevenueChartOptionsChange() {
      renderDynamicRevenueChart();
    }

    // Handles clicking top KPI cards in Sales Intelligence (PHASE 12)
    function onSalesKpiCardClick(kpiName) {
      const groupSelect = document.getElementById('chart-groupby-select');
      const metricSelect = document.getElementById('chart-metric-select');
      
      if (!groupSelect || !metricSelect) return;

      if (kpiName === 'Total Revenue') {
        groupSelect.value = 'Month';
        metricSelect.value = 'Revenue';
      } else if (kpiName === 'Total Packages') {
        groupSelect.value = 'Package';
        metricSelect.value = 'Count';
      } else if (kpiName === 'Top Source') {
        groupSelect.value = 'Source';
        metricSelect.value = 'Count';
      } else if (kpiName === 'Top Center') {
        groupSelect.value = 'Center';
        metricSelect.value = 'Revenue';
      }
      
      renderDynamicRevenueChart();
    }

    function renderDynamicRevenueChart() {
      if (!revenueDataProcessed || !revKpisCache.records) return;
      
      const isLight = document.body.classList.contains('light-theme');
      const gridColor = isLight ? 'rgba(15, 23, 42, 0.05)' : 'rgba(255, 255, 255, 0.05)';
      const tickColor = isLight ? '#475569' : '#94a3b8';
      
      const groupSelect = document.getElementById('chart-groupby-select');
      const metricSelect = document.getElementById('chart-metric-select');
      if (!groupSelect || !metricSelect) return;

      const groupVal = groupSelect.value;
      const metricVal = metricSelect.value;
      const titleEl = document.getElementById("dynamicChartTitle");
      const badgeEl = document.getElementById("dynamicChartBadge");
      const ctx = document.getElementById("dynamicRevenueChart").getContext('2d');
      
      if (window.dynamicRevChartRef) window.dynamicRevChartRef.destroy();
      
      // Update Title & Badge
      titleEl.innerText = groupVal + "-wise " + (metricVal === 'Revenue' ? 'Revenue' : 'Volume') + " Breakdown";
      badgeEl.innerText = metricVal === 'Revenue' ? "Currency (₹)" : "Count (Tx)";
      badgeEl.className = metricVal === 'Revenue' 
        ? "text-xs text-violet-400 border border-violet-500/30 bg-violet-900/20 px-2 py-1 rounded"
        : "text-xs text-sky-400 border border-sky-500/30 bg-sky-900/20 px-2 py-1 rounded";

      let chartType = 'bar';
      let chartData = {};
      let chartOptions = { 
        responsive: true, 
        maintainAspectRatio: false, 
        plugins: { 
          legend: { display: false },
          tooltip: {
            callbacks: {
              label: function(context) {
                let value = context.raw || 0;
                if (metricVal === 'Revenue') {
                  return ' Revenue: ₹' + value.toLocaleString('en-IN');
                } else {
                  return ' Count: ' + value + ' deals';
                }
              }
            }
          }
        },
        scales: {
          y: { grid: { color: gridColor }, ticks: { color: tickColor } },
          x: { grid: { display: false }, ticks: { color: tickColor } }
        }
      };

      let labels = [];
      let dataVals = [];
      let themeColor = '#8b5cf6'; // default violet
      
      if (groupVal === 'Month') {
        chartType = 'line';
        themeColor = '#8b5cf6';
        let sortedMonths = Object.keys(revKpisCache.monthRev).sort((a,b) => {
          let da = new Date('01 ' + a);
          let db = new Date('01 ' + b);
          if (isNaN(da.getTime()) || isNaN(db.getTime())) return a.localeCompare(b);
          return da - db;
        });
        
        labels = sortedMonths;
        if (metricVal === 'Revenue') {
          dataVals = sortedMonths.map(m => revKpisCache.monthRev[m]);
        } else {
          // Count transaction per month
          let monthCounts = {};
          revKpisCache.records.forEach(r => {
            let mRaw = r.month_date || '';
            let m = 'Unknown';
            if (mRaw && mRaw !== 'Unknown') {
              let d = new Date(mRaw);
              if (!isNaN(d.getTime())) {
                const monthNames = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
                m = monthNames[d.getMonth()] + ' ' + d.getFullYear();
              } else { m = mRaw; }
            }
            if (m !== 'Unknown') monthCounts[m] = (monthCounts[m] || 0) + 1;
          });
          dataVals = sortedMonths.map(m => monthCounts[m] || 0);
        }
      } 
      else if (groupVal === 'Center') {
        themeColor = '#fbbf24'; // amber
        let ctrKeys = Object.keys(revKpisCache.centerRev);
        if (metricVal === 'Revenue') {
          ctrKeys.sort((a,b) => revKpisCache.centerRev[b] - revKpisCache.centerRev[a]);
          labels = ctrKeys.slice(0, 12);
          dataVals = labels.map(c => revKpisCache.centerRev[c]);
        } else {
          let ctrCounts = {};
          revKpisCache.records.forEach(r => {
            let c = r.center_name || 'Unknown';
            ctrCounts[c] = (ctrCounts[c] || 0) + 1;
          });
          let sortedCtrs = Object.keys(ctrCounts).sort((a,b) => ctrCounts[b] - ctrCounts[a]);
          labels = sortedCtrs.slice(0, 12);
          dataVals = labels.map(c => ctrCounts[c]);
        }
      } 
      else if (groupVal === 'Package') {
        themeColor = '#10b981'; // emerald
        if (metricVal === 'Revenue') {
          let pkgKeys = Object.keys(revKpisCache.packageRev).sort((a,b) => revKpisCache.packageRev[b] - revKpisCache.packageRev[a]);
          labels = pkgKeys.slice(0, 15);
          dataVals = labels.map(p => revKpisCache.packageRev[p]);
        } else {
          let pkgKeys = Object.keys(revKpisCache.packageCounts).sort((a,b) => revKpisCache.packageCounts[b] - revKpisCache.packageCounts[a]);
          labels = pkgKeys.slice(0, 15);
          dataVals = labels.map(p => revKpisCache.packageCounts[p]);
        }
      } 
      else if (groupVal === 'Source') {
        chartType = 'doughnut';
        let srcKeys = Object.keys(revKpisCache.sourceCounts);
        labels = srcKeys;
        if (metricVal === 'Revenue') {
          dataVals = srcKeys.map(s => revKpisCache.sourceRev[s]);
        } else {
          dataVals = srcKeys.map(s => revKpisCache.sourceCounts[s]);
        }
        chartOptions.plugins.legend = { display: true, position: 'right', labels: { color: '#94a3b8', usePointStyle: true } };
        chartOptions.cutout = '60%';
      } 
      else if (groupVal === 'AM') {
        themeColor = '#38bdf8'; // sky
        let amKeys = Object.keys(revKpisCache.amRev);
        if (metricVal === 'Revenue') {
          amKeys.sort((a,b) => revKpisCache.amRev[b] - revKpisCache.amRev[a]);
          labels = amKeys;
          dataVals = labels.map(a => revKpisCache.amRev[a]);
        } else {
          let amCounts = {};
          revKpisCache.records.forEach(r => {
            let a = r.amName || 'Unassigned';
            amCounts[a] = (amCounts[a] || 0) + 1;
          });
          let sortedAMs = Object.keys(amCounts).sort((a,b) => amCounts[b] - amCounts[a]);
          labels = sortedAMs;
          dataVals = labels.map(a => amCounts[a]);
        }
      }

      if (chartType === 'line') {
        chartData = {
          labels: labels,
          datasets: [{ 
            label: groupVal + ' Breakdown', 
            data: dataVals, 
            borderColor: themeColor, 
            backgroundColor: themeColor + '10', 
            borderWidth: 3, 
            tension: 0.4, 
            fill: true 
          }]
        };
      } else if (chartType === 'doughnut') {
        chartData = {
          labels: labels,
          datasets: [{
            data: dataVals,
            backgroundColor: chartColors.slice(0, labels.length),
            borderWidth: 0,
            hoverOffset: 8
          }]
        };
        delete chartOptions.scales;
      } else {
        chartData = {
          labels: labels,
          datasets: [{ 
            label: groupVal + ' Breakdown', 
            data: dataVals, 
            backgroundColor: themeColor, 
            borderRadius: 6 
          }]
        };
      }

      window.dynamicRevChartRef = new Chart(ctx, { type: chartType, data: chartData, options: chartOptions });
    }
    function setupFilters() {
      const amSelect = document.getElementById('global-am-filter');
      if (!amSelect) return;
      
      let uniqueMonths = [...new Set(globalMasterData.map(item => item.monthYear).filter(m => m && m !== "Unknown"))];
      let uniqueAMs = [...new Set(globalMasterData.map(item => item.amName).filter(am => am && am !== "Unassigned"))].sort();

      const monthOptionsDiv = document.getElementById('global-month-options');
      if (monthOptionsDiv) {
        let html = `
          <label class="flex items-center gap-2 p-2 hover:bg-slate-700 rounded cursor-pointer transition-colors">
            <input type="checkbox" id="global-month-all" checked onchange="toggleAllMonths('global')" class="rounded border-slate-600 text-sky-500 bg-slate-900 focus:ring-0">
            <span class="text-sm text-white">All Months</span>
          </label>
        `;
        uniqueMonths.forEach(m => {
          html += `
            <label class="flex items-center gap-2 p-2 hover:bg-slate-700 rounded cursor-pointer transition-colors">
              <input type="checkbox" value="${m}" onchange="handleMonthCb('global')" class="global-month-cb rounded border-slate-600 text-sky-500 bg-slate-900 focus:ring-0">
              <span class="text-sm text-white">${m}</span>
            </label>
          `;
        });
        monthOptionsDiv.innerHTML = html;
      }

      amSelect.innerHTML = '<option value="All" class="bg-slate-800">All Account Managers</option>';
      if (loggedInUser.role !== "Admin") {
        amSelect.innerHTML = `<option value="${loggedInUser.name}" class="bg-slate-800">${loggedInUser.name}</option>`;
        amSelect.disabled = true; 
        amSelect.classList.add("opacity-50", "cursor-not-allowed");
        amSelect.value = loggedInUser.name;
      } else {
        amSelect.disabled = false;
        amSelect.classList.remove("opacity-50", "cursor-not-allowed");
        uniqueAMs.forEach(am => {
          amSelect.innerHTML += `<option value="${am}" class="bg-slate-800">${am}</option>`;
        });
      }
    }

    function setupExecFilters() {
      const amSelect = document.getElementById('exec-am-filter');
      if (!amSelect) return;

      let uniqueMonths = [...new Set(globalMasterData.map(item => item.monthYear).filter(m => m && m !== "Unknown"))];
      let uniqueAMs = [...new Set(globalMasterData.map(item => item.amName).filter(am => am && am !== "Unassigned"))].sort();

      // Populate Month
      let monthOpts = uniqueMonths.map(m => { return { value: m, label: m }; });
      populateMultiSelect('exec-month-options', monthOpts, 'exec-month', 'All Months');

      // Populate AM
      const amContainer = document.getElementById('exec-am-filter-container');
      amSelect.innerHTML = '<option value="All" class="bg-slate-800">All Account Managers</option>';
      if (loggedInUser.role !== "Admin") {
        amSelect.innerHTML = `<option value="${loggedInUser.name}" class="bg-slate-800">${loggedInUser.name}</option>`;
        amSelect.value = loggedInUser.name;
        amSelect.disabled = true;
        amSelect.classList.add("opacity-50", "cursor-not-allowed");
        if (amContainer) amContainer.classList.add("hidden");
      } else {
        amSelect.disabled = false;
        amSelect.classList.remove("opacity-50", "cursor-not-allowed");
        if (amContainer) amContainer.classList.remove("hidden");
        uniqueAMs.forEach(am => {
          amSelect.innerHTML += `<option value="${am}" class="bg-slate-800">${am}</option>`;
        });
      }

      // Populate Client based on initial AM
      setupExecClientDropdown();
    }

    function handleExecAMChange() {
      setupExecClientDropdown();
      applyExecFilters();
    }

    function setupExecClientDropdown() {
      const amSel = document.getElementById('exec-am-filter');
      const selectedAM = amSel ? amSel.value : "All";
      
      let filteredRecords = globalMasterData || [];
      if (selectedAM !== "All") {
        filteredRecords = filteredRecords.filter(item => isAmMatch(item.amName, selectedAM));
      }
      
      let uniqueClients = [...new Set(filteredRecords.map(item => item.clientName).filter(c => c && c !== "Unknown"))].sort();
      populateMultiSelect('exec-client-options', uniqueClients, 'exec-client', 'All Clients');
      updateFilterText('exec-client', 'All Clients');
    }

    // Custom Multi-Select Functions
    document.addEventListener('click', function(e) {
      ['global-month', 'sales-month', 'sales-source', 'sales-center', 'exec-month', 'exec-client'].forEach(prefix => {
        const container = document.getElementById(prefix + '-filter-container');
        const opts = document.getElementById(prefix + '-options');
        if (container && opts && !container.contains(e.target)) {
          opts.classList.add('hidden');
        }
      });
    });

    function toggleDropdown(id) {
      document.getElementById(id).classList.toggle('hidden');
    }
    function toggleAllCheckboxes(prefix, labelAll) {
      const allCb = document.getElementById(prefix + '-all');
      const cbs = document.querySelectorAll('.' + prefix + '-cb');
      cbs.forEach(cb => cb.checked = false);
      updateFilterText(prefix, labelAll);
      if(prefix.startsWith('global')) applyGlobalFilters();
      else if(prefix.startsWith('sales')) applySalesFilters();
      else if(prefix.startsWith('exec')) applyExecFilters();
    }
    function handleCbChange(prefix, labelAll) {
      const allCb = document.getElementById(prefix + '-all');
      const cbs = Array.from(document.querySelectorAll('.' + prefix + '-cb'));
      const anyChecked = cbs.some(cb => cb.checked);
      if (anyChecked && allCb) allCb.checked = false;
      else if (!anyChecked && allCb) allCb.checked = true;
      updateFilterText(prefix, labelAll);
      if(prefix.startsWith('global')) applyGlobalFilters();
      else if(prefix.startsWith('sales')) applySalesFilters();
      else if(prefix.startsWith('exec')) applyExecFilters();
    }
    function updateFilterText(prefix, labelAll) {
      const allCb = document.getElementById(prefix + '-all');
      const textSpan = document.getElementById(prefix + '-filter-text');
      if (!textSpan) return;
      if (allCb && allCb.checked) {
        textSpan.textContent = labelAll;
        return;
      }
      const cbs = Array.from(document.querySelectorAll('.' + prefix + '-cb')).filter(cb => cb.checked);
      if (cbs.length === 1) textSpan.textContent = cbs[0].value;
      else if (cbs.length > 1) textSpan.textContent = cbs.length + " Selected";
      else textSpan.textContent = labelAll;
    }

    function applyGlobalFilters() {
      const allCb = document.getElementById('global-month-all');
      let selectedMonths = [];
      if (!allCb || !allCb.checked) {
        selectedMonths = Array.from(document.querySelectorAll('.global-month-cb')).filter(cb => cb.checked).map(cb => cb.value);
      }
      
      let selectedAM = document.getElementById('global-am-filter').value;
      

      currentFilteredData = globalMasterData.filter(item => {
        let monthMatch = true;
        if (allCb && !allCb.checked) {
          monthMatch = selectedMonths.length > 0 ? selectedMonths.includes(item.monthYear) : true;
        }
        let amMatch = (selectedAM === "All") || isAmMatch(item.amName, selectedAM);
        
        if (loggedInUser.role !== 'Admin') {
          if (!isAmMatch(item.amName, loggedInUser.name)) {
            return false;
          }
        }
        
        return monthMatch && amMatch;
      });

      if (activeKpiFilter) {
        if (activeKpiFilter === 'totalQuotes') {
          activeKpiFilteredRecords = currentFilteredData;
        } else if (activeKpiFilter === 'dealsClosed') {
          activeKpiFilteredRecords = currentFilteredData.filter(r => r.quoteStatus === 'Deal Won');
        } else if (activeKpiFilter === 'dealsLost') {
          activeKpiFilteredRecords = currentFilteredData.filter(r => {
            let d = r.quoteStatus ? r.quoteStatus.toLowerCase().trim() : '';
            return d === 'deal lost' || d === 'lost' || d === 'dropped' || d === 'cancelled' || d === 'closed - lost';
          });
        } else if (activeKpiFilter === 'pendingQuotes') {
          activeKpiFilteredRecords = currentFilteredData.filter(r => r.quoteStatus !== 'Deal Won');
        }
      }

      recalculateKPIsAndCharts();
    }

    function clearGlobalFilters() {
      const allCb = document.getElementById('global-month-all');
      if (allCb) {
        allCb.checked = true;
        document.querySelectorAll('.global-month-cb').forEach(cb => cb.checked = false);
        updateMonthFilterText('global');
      }
      if (loggedInUser.role === 'Admin') {
        document.getElementById('global-am-filter').value = 'All';
      }
      
      applyGlobalFilters();
      closeKpiDetailModal();
      showToast('Filters cleared for Overall Summary', 'success');
    }

    function applyExecFilters() {
      const monthAllCb = document.getElementById('exec-month-all');
      let selectedMonths = [];
      if (!monthAllCb || !monthAllCb.checked) {
        selectedMonths = Array.from(document.querySelectorAll('.exec-month-cb')).filter(cb => cb.checked).map(cb => cb.value);
      }

      const clientAllCb = document.getElementById('exec-client-all');
      let selectedClients = [];
      if (!clientAllCb || !clientAllCb.checked) {
        selectedClients = Array.from(document.querySelectorAll('.exec-client-cb')).filter(cb => cb.checked).map(cb => cb.value);
      }

      let selectedAM = document.getElementById('exec-am-filter') ? document.getElementById('exec-am-filter').value : 'All';

      execFilteredData = globalMasterData.filter(item => {
        let monthMatch = true;
        if (monthAllCb && !monthAllCb.checked) {
          monthMatch = selectedMonths.length > 0 ? selectedMonths.includes(item.monthYear) : true;
        }

        let amMatch = (selectedAM === "All") || isAmMatch(item.amName, selectedAM);

        let clientMatch = true;
        if (clientAllCb && !clientAllCb.checked) {
          clientMatch = selectedClients.length > 0 ? selectedClients.includes(item.clientName) : true;
        }
        
        if (loggedInUser.role !== 'Admin') {
          if (!isAmMatch(item.amName, loggedInUser.name)) {
            return false;
          }
        }
        
        return monthMatch && amMatch && clientMatch;
      });

      currentExecPage = 1;
      recalculateExecKPIsAndCharts();
    }

    function clearExecFilters() {
      ['exec-month', 'exec-client'].forEach(prefix => {
        const allCb = document.getElementById(prefix + '-all');
        if (allCb) {
          allCb.checked = true;
          document.querySelectorAll('.' + prefix + '-cb').forEach(cb => cb.checked = false);
          
          let labelAll = "All Months";
          if(prefix === 'exec-client') labelAll = "All Clients";
          updateFilterText(prefix, labelAll);
        }
      });

      if (loggedInUser.role === "Admin") {
        let amSel = document.getElementById('exec-am-filter');
        if(amSel) amSel.value = 'All';
      }
      setupExecClientDropdown(); // Reset client options based on 'All' AM
      applyExecFilters();
      closeExecKpiDetailModal();
      showToast('Filters cleared for Executive Overview', 'success');
    }

    function recalculateExecKPIsAndCharts() {
      let records = execFilteredData;
      let totalPipeline = records.length;
      let uniqueClients = new Set();
      let clientCounts = {};
      let totalPackages = 0;
      let amCounts = {};

      records.forEach(r => {
        if (r.clientName) {
          uniqueClients.add(r.clientName);
          clientCounts[r.clientName] = (clientCounts[r.clientName] || 0) + 1;
        }
        if (r.packageCount) {
          totalPackages += r.packageCount;
        }
        if (r.amName && r.amName !== "Unassigned") {
          amCounts[r.amName] = (amCounts[r.amName] || 0) + 1;
        }
      });

      let topClient = "N/A", topClientCount = 0;
      for (let cl in clientCounts) {
        if (clientCounts[cl] > topClientCount) {
          topClientCount = clientCounts[cl];
          topClient = cl;
        }
      }

      animateCounter('exec-kpi-pipeline', totalPipeline, 600);
      animateCounter('exec-kpi-active-clients', uniqueClients.size, 500);
      animateCounter('exec-kpi-package-count', totalPackages, 800);
      
      const topClientEl = document.getElementById('exec-kpi-top-client');
      if (topClientEl) {
        topClientEl.innerText = topClient;
        topClientEl.title = topClient !== "N/A" ? `${topClient} (${topClientCount} Quotes)` : "N/A";
      }

      drawExecAmChart(records);

      buildExecDealRegistry();
    }

    function drawExecAmChart(records) {
      let amCounts = {};
      records.forEach(r => {
        if (r.amName && r.amName !== "Unassigned") {
          amCounts[r.amName] = (amCounts[r.amName] || 0) + 1;
        }
      });
      const amLabels = Object.keys(amCounts);
      const amData = Object.values(amCounts);
      
      const isLight = document.body.classList.contains('light-theme');
      const gridColor = isLight ? 'rgba(15, 23, 42, 0.05)' : 'rgba(255, 255, 255, 0.05)';
      const tickColor = isLight ? '#475569' : '#94a3b8';

      const execCtx = document.getElementById('execAmChart').getContext('2d');
      if (window.execAmRef) window.execAmRef.destroy();
      
      window.execAmRef = new Chart(execCtx, {
        type: 'bar',
        data: {
          labels: amLabels,
          datasets: [{
            label: 'Quotes Per AM',
            data: amData,
            backgroundColor: 'rgba(56, 189, 248, 0.7)',
            borderColor: '#38bdf8',
            borderWidth: 1,
            borderRadius: 6
          }]
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          scales: {
            y: { beginAtZero: true, grid: { color: gridColor }, ticks: { color: tickColor } },
            x: { grid: { display: false }, ticks: { color: tickColor } }
          },
          plugins: {
            legend: { display: false }
        function buildExecDealRegistry() {
      const tbody = document.getElementById('exec-deal-registry-body');
      if (!tbody) return;

      let recordsToRender = activeExecKpiFilter ? activeExecKpiFilteredRecords : execFilteredData;
      
      const totalPages = Math.ceil(recordsToRender.length / EXEC_PAGE_SIZE);
      if (currentExecPage > totalPages && totalPages > 0) currentExecPage = totalPages;
      if (currentExecPage < 1) currentExecPage = 1;

      const startIndex = (currentExecPage - 1) * EXEC_PAGE_SIZE;
      const endIndex = startIndex + EXEC_PAGE_SIZE;
      const pageRecords = recordsToRender.slice(startIndex, endIndex);

      let html = '';
      pageRecords.forEach((r, i) => {
        let revFormatted = r.revenue ? '?' + r.revenue.toLocaleString('en-IN') : '-';
        
        let statusColor = "text-sky-400 border-sky-400/30 bg-sky-900/20";
        if (r.quoteStatus === "Deal Won") statusColor = "text-emerald-400 border-emerald-400/30 bg-emerald-900/20";
        else if (r.quoteStatus === "Deal Lost") statusColor = "text-rose-400 border-rose-400/30 bg-rose-900/20";
        else if (r.quoteStatus === "Quote Shared") statusColor = "text-amber-400 border-amber-400/30 bg-amber-900/20";
        else if (r.quoteStatus === "Negotiation") statusColor = "text-purple-400 border-purple-400/30 bg-purple-900/20";

        html += '<tr class="border-b border-slate-800/30 hover:bg-slate-800/20 transition-colors">';
        html += '<td class="py-3 px-4 text-slate-500 text-sm font-mono">' + (r.quoteCode || 'N/A') + '</td>';
        html += '<td class="py-3 px-4 text-white font-medium truncate max-w-[200px]">' + (r.clientName || 'N/A') + '</td>';
        html += '<td class="py-3 px-4 text-slate-400 text-sm">' + (r.amName || 'N/A') + '</td>';
        html += '<td class="py-3 px-4"><span class="text-xs px-2 py-1 rounded-md border ' + statusColor + '">' + (r.quoteStatus || 'Pending') + '</span></td>';
        html += '<td class="py-3 px-4 text-slate-400 text-sm">' + (r.type || 'Unknown') + '</td>';
        html += '<td class="py-3 px-4 text-emerald-400 font-bold tracking-wider">' + revFormatted + '</td>';
        html += '</tr>';
      });

      if (html === '') {
        html = '<tr><td colspan="6" class="text-center text-slate-500 py-8">No Matching Deals Found</td></tr>';
      }
      tbody.innerHTML = html;
      
      const paginationContainer = document.getElementById('exec-deal-registry-pagination');
      if (paginationContainer) {
        if (totalPages <= 1) {
          paginationContainer.innerHTML = '';
        } else {
          let prevDisabled = currentExecPage === 1 ? 'opacity-50 cursor-not-allowed' : 'hover:bg-slate-700 cursor-pointer';
          let nextDisabled = currentExecPage === totalPages ? 'opacity-50 cursor-not-allowed' : 'hover:bg-slate-700 cursor-pointer';
          
          paginationContainer.innerHTML = `
            <div class="text-sm text-slate-400">Showing ${startIndex + 1} to ${Math.min(endIndex, recordsToRender.length)} of ${recordsToRender.length}</div>
            <div class="flex gap-2">
              <button onclick="changeExecPage(-1)" class="bg-slate-800 text-white px-3 py-1 rounded border border-slate-700 ${prevDisabled}" ${currentExecPage === 1 ? 'disabled' : ''}>Previous</button>
              <button onclick="changeExecPage(1)" class="bg-slate-800 text-white px-3 py-1 rounded border border-slate-700 ${nextDisabled}" ${currentExecPage === totalPages ? 'disabled' : ''}>Next</button>
            </div>
          `;
        }
      }
    }

    function changeExecPage(delta) {
      currentExecPage += delta;
      buildExecDealRegistry();
    }

    function toggleExecKpiFilter(kpiLabel, dataKey) {
        if (activeExecKpiFilter === dataKey) {
          closeExecKpiDetailModal();
          return;
        }
        
        activeExecKpiFilter = dataKey;
        currentExecPage = 1;
        let matched = [];
        let subtitle = "";
  
        if (dataKey === 'totalPipeline') {
          matched = execFilteredData;
          subtitle = "All active deals currently in the pipeline";
        } else if (dataKey === 'topClient') {
          let clientCounts = {};
          execFilteredData.forEach(r => {
            if (r.clientName) clientCounts[r.clientName] = (clientCounts[r.clientName] || 0) + 1;
          });
          let sortedClients = Object.keys(clientCounts).sort((a, b) => clientCounts[b] - clientCounts[a]);
          let top10Clients = sortedClients.slice(0, 10);
          matched = execFilteredData.filter(r => top10Clients.includes(r.clientName));
          subtitle = `Deals for Top 10 Clients`;
        } else if (dataKey === 'activeClients') {
          let clientCounts = {};
          execFilteredData.forEach(r => {
            if (r.clientName) clientCounts[r.clientName] = (clientCounts[r.clientName] || 0) + 1;
          });
          matched = execFilteredData; // Keep full set, or filter by unique client list
          subtitle = "Deals active clients";
        } else if (dataKey === 'packageCount') {
          matched = execFilteredData.filter(r => r.revenuePackage && r.revenuePackage !== 'N/A');
          subtitle = "Deals with packages defined";
        }
  
        activeExecKpiFilteredRecords = matched;
        
        resetAllExecKpiCardStyles();
        
        // Highlight clicked card
        const cardIdMap = {
          'totalPipeline': 'exec-card-pipeline',
          'topClient': 'exec-card-top-client',
          'activeClients': 'exec-card-client-count',
          'packageCount': 'exec-card-package-count'
        };
        const cardId = cardIdMap[dataKey];
        const cardEl = document.getElementById(cardId);
        if (cardEl) {
          cardEl.classList.remove('border-x-slate-700/50', 'border-b-slate-700/50');
          cardEl.classList.add('border-sky-400', 'shadow-[0_0_25px_rgba(56,189,248,0.35)]');
        }
        
        drawExecAmChart(matched);
        buildExecDealRegistry();
      }
  
      function closeExecKpiDetailModal() {
        activeExecKpiFilter = null;
        activeExecKpiFilteredRecords = [];
        currentExecPage = 1;
        resetAllExecKpiCardStyles();
        drawExecAmChart(execFilteredData);
        buildExecDealRegistry();
      }
      
      function resetAllExecKpiCardStyles() {
      const cards = {
        'exec-card-pipeline': 'border-sky-500',
        'exec-card-top-client': 'border-rose-500',
        'exec-card-client-count': 'border-emerald-500',
        'exec-card-package-count': 'border-amber-500'
      };
      for (let cardId in cards) {
        const el = document.getElementById(cardId);
        if (el) {
          el.className = `premium-glass kpi-card p-5 rounded-2xl cursor-pointer border-t-2 ${cards[cardId]} border-x border-b border-x-slate-700/50 border-b-slate-700/50 hover:border-x-sky-500/50 hover:border-b-sky-500/50 transition-all duration-300 hover:shadow-[0_0_25px_rgba(56,189,248,0.15)]`;
        }
      }
    }

    function recalculateKPIsAndCharts() {
      let records = currentFilteredData;
      let totalQuotes = 0, dealsClosed = 0, dealsLost = 0, pendingQuotes = 0, totalRevenue = 0;
      let uniqueClients = new Set();
      let clientCounts = {};
      let monthYearCounts = {}, amCounts = {}, statusCounts = {}, typeCounts = {}, dealStatusCounts = {};

      records.forEach(r => {
        totalQuotes++;
        if (r.clientName) {
          uniqueClients.add(r.clientName);
          clientCounts[r.clientName] = (clientCounts[r.clientName] || 0) + 1;
        }
        
        let qStatus = r.quoteStatus ? r.quoteStatus.trim() : 'Pending';
        let qStatusLower = qStatus.toLowerCase();
        
        // "Conversion Rate" = Deal Won (Column "Quote Status" is Deal Won)
        let isWon = (qStatus === 'Deal Won');
        // "Loss Rate" = Deal Lost (Column "Quote Status" is closed - lost, deal lost, lost, dropped, cancelled)
        let isLost = (qStatusLower === 'closed - lost' || qStatusLower === 'deal lost' || qStatusLower === 'lost' || qStatusLower === 'dropped' || qStatusLower === 'cancelled');
        // "In Negotiation" = Everything except Deal Won
        
        if (isWon) {
          dealsClosed++;
          totalRevenue += (r.revenue || 0);
        } else if (isLost) {
          dealsLost++;
        }
        
        if (!isWon) {
          pendingQuotes++;
        }

        if (r.monthYear !== "Unknown") monthYearCounts[r.monthYear] = (monthYearCounts[r.monthYear] || 0) + 1;
        if (r.amName !== "" && r.amName !== "Unassigned") amCounts[r.amName] = (amCounts[r.amName] || 0) + 1;
        if (r.quoteStatus) statusCounts[r.quoteStatus] = (statusCounts[r.quoteStatus] || 0) + 1;
        if (r.dealStatus) {
          let s = formatStatusForDisplay(r.dealStatus);
          dealStatusCounts[s] = (dealStatusCounts[s] || 0) + 1;
        }
        if (r.type && r.type !== "Unknown") typeCounts[r.type] = (typeCounts[r.type] || 0) + 1;
      });

      let topAM = "N/A", topAMCount = 0;
      for (let am in amCounts) { if (amCounts[am] > topAMCount) { topAMCount = amCounts[am]; topAM = am; } }

      let topClient = "N/A", topClientCount = 0;
      for (let cl in clientCounts) { if (clientCounts[cl] > topClientCount) { topClientCount = clientCounts[cl]; topClient = cl; } }

      let sortedMonths = Object.keys(monthYearCounts).sort((a, b) => {
        return new Date("01 " + a) - new Date("01 " + b);
      });
      let sortedMonthData = sortedMonths.map(m => monthYearCounts[m]);

      globalData = {
        kpis: {
          totalQuotes, activeClients: uniqueClients.size, dealsClosed, dealsLost, pendingQuotes, totalRevenue, topAM, topAMCount, topClient, topClientCount
        },
        charts: {
          months: sortedMonths, monthData: sortedMonthData,
          ams: Object.keys(amCounts), amData: Object.values(amCounts),
          statuses: Object.keys(statusCounts), statusData: Object.values(statusCounts),
          types: Object.keys(typeCounts), typeData: Object.values(typeCounts),
          dealStatuses: Object.keys(dealStatusCounts), dealStatusData: Object.values(dealStatusCounts)
        }
      };

      updateDashboardDOMFromGlobalData();
    }

    function updateDashboardDOMFromGlobalData() {
      const data = globalData;
      const isLight = document.body.classList.contains('light-theme');
      Chart.defaults.color = isLight ? '#475569' : '#64748b';
      Chart.defaults.font.family = "'Inter', sans-serif";

      // ===== OVERALL SUMMARY KPIs =====
      animateCounter('kpi-total-quotes', data.kpis.totalQuotes, 800);
      animateCounter('kpi-pending', data.kpis.pendingQuotes, 600);
      animateCounter('kpi-conv-rate', data.kpis.dealsClosed, 600);
      animateCounter('kpi-loss-rate', data.kpis.dealsLost, 600);
      
      let convRate = data.kpis.totalQuotes > 0 ? ((data.kpis.dealsClosed / data.kpis.totalQuotes) * 100).toFixed(1) + '%' : '0%';
      let pendingRate = data.kpis.totalQuotes > 0 ? ((data.kpis.pendingQuotes / data.kpis.totalQuotes) * 100).toFixed(1) + '%' : '0%';
      let lossRate = data.kpis.totalQuotes > 0 ? ((data.kpis.dealsLost / data.kpis.totalQuotes) * 100).toFixed(1) + '%' : '0%';

      const convSub = document.getElementById('kpi-conv-rate-sub');
      if (convSub) {
        convSub.innerText = 'Deals Won (' + convRate + ')';
      }
      const pendingSub = document.getElementById('kpi-pending-sub');
      if (pendingSub) {
        pendingSub.innerText = 'Pending Actions (' + pendingRate + ')';
      }
      const lossSub = document.getElementById('kpi-loss-rate-sub');
      if (lossSub) {
        lossSub.innerText = 'Dropped Deals (' + lossRate + ')';
      }

      // ===== EXECUTIVE KPIs =====
      // Relocated to recalculateExecKPIsAndCharts()

      // Re-init charts (destroy existing if needed)
      if (chartsInitialized.overall) { chartsInitialized.overall = false; }
      initOverallCharts(); // Always re-init active overall charts

      buildActiveDealRegistry();
      
      // Remove spin from sync icon if any
      const icon = document.getElementById('sync-icon');
      if (icon) icon.classList.remove('fa-spin');
    }

    // ============== CHART COLOR PALETTE ==============
    const chartColors = [
      '#38bdf8', '#818cf8', '#34d399', '#fbbf24', '#f87171', 
      '#a78bfa', '#2dd4bf', '#fb923c', '#e879f9', '#60a5fa',
      '#4ade80', '#f472b6', '#facc15', '#22d3ee', '#c084fc'
    ];

    // ============== TAB 1: OVERALL SUMMARY CHARTS ==============
    function initOverallCharts() {
      if (!globalData.charts) return;
      chartsInitialized.overall = true;

      const isLight = document.body.classList.contains('light-theme');
      const gridColor = isLight ? 'rgba(15, 23, 42, 0.05)' : 'rgba(255, 255, 255, 0.05)';
      const tickColor = isLight ? '#475569' : '#94a3b8';

      // 1. Pie Chart: Quote Status Breakdown (REMOVED)

      // 2. Line Chart: Volume Trajectory
      const lineCtx = document.getElementById('trendLineChart').getContext('2d');
      
      let activeColor = '#38bdf8'; // Default sky blue
      let datasetLabel = 'Quotes Generated';
      let activeData = globalData.charts.monthData;
      
      if (activeKpiFilter) {
        const colorMap = {
          'totalQuotes': '#38bdf8',
          'dealsClosed': '#34d399',
          'pendingQuotes': '#fbbf24',
          'dealsLost': '#f87171'
        };
        const labelMap = {
          'totalQuotes': 'Total Pipeline',
          'dealsClosed': 'Deals Won',
          'pendingQuotes': 'In Negotiation',
          'dealsLost': 'Deals Lost'
        };
        activeColor = colorMap[activeKpiFilter] || '#38bdf8';
        datasetLabel = labelMap[activeKpiFilter] || 'Quotes Generated';
        
        let sortedMonths = globalData.charts.months || [];
        let monthCounts = {};
        sortedMonths.forEach(m => { monthCounts[m] = 0; });
        
        currentFilteredData.forEach(r => {
          let m = r.monthYear;
          if (m && m !== "Unknown" && monthCounts[m] !== undefined) {
            let match = false;
            if (activeKpiFilter === 'totalQuotes') {
              match = true;
            } else if (activeKpiFilter === 'dealsClosed') {
              match = (r.quoteStatus === 'Deal Won');
            } else if (activeKpiFilter === 'pendingQuotes') {
              match = (r.quoteStatus !== 'Deal Won');
            } else if (activeKpiFilter === 'dealsLost') {
              let status = r.quoteStatus ? r.quoteStatus.toLowerCase().trim() : '';
              match = (status === 'deal lost' || status === 'lost' || status === 'dropped' || status === 'cancelled' || status === 'closed - lost');
            }
            
            if (match) {
              monthCounts[m]++;
            }
          }
        });
        
        activeData = sortedMonths.map(m => monthCounts[m]);
      }
      
      let gradient = lineCtx.createLinearGradient(0, 0, 0, 400);
      let rgb = '56, 189, 248'; // default sky rgb
      if (activeColor === '#34d399') rgb = '52, 211, 153';
      else if (activeColor === '#fbbf24') rgb = '251, 191, 36';
      else if (activeColor === '#f87171') rgb = '248, 113, 113';
      
      gradient.addColorStop(0, 'rgba(' + rgb + ', 0.5)');
      gradient.addColorStop(1, 'rgba(' + rgb + ', 0)');

      if(window.overallLineRef) window.overallLineRef.destroy();
      window.overallLineRef = new Chart(lineCtx, {
        type: 'line',
        data: {
          labels: globalData.charts.months,
          datasets: [{
            label: datasetLabel,
            data: activeData,
            borderColor: activeColor,
            backgroundColor: gradient,
            borderWidth: 3,
            fill: true,
            tension: 0.4,
            pointBackgroundColor: isLight ? '#ffffff' : '#050505',
            pointBorderColor: activeColor,
            pointBorderWidth: 2,
            pointRadius: 5
          }]
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          scales: {
            y: { grid: { color: gridColor }, ticks: { color: tickColor }, beginAtZero: true },
            x: { grid: { color: gridColor }, ticks: { color: tickColor } }
          },
          plugins: { legend: { display: false } }
        }
      });

      // 3. Channel Allocation Donut (from Type column)
      if (globalData.charts.types && globalData.charts.types.length > 0) {
        const chCtx = document.getElementById('channelDonutChart').getContext('2d');
        if(window.channelDonutRef) window.channelDonutRef.destroy();
        window.channelDonutRef = new Chart(chCtx, {
          type: 'doughnut',
          data: {
            labels: globalData.charts.types,
            datasets: [{
              data: globalData.charts.typeData,
              backgroundColor: ['#a78bfa','#38bdf8','#34d399','#fbbf24','#f87171','#818cf8','#2dd4bf','#fb923c','#e879f9','#60a5fa'],
              borderWidth: 0,
              hoverOffset: 10
            }]
          },
          options: {
            responsive: true,
            maintainAspectRatio: false,
            cutout: '65%',
            plugins: {
              legend: { position: 'right', labels: { color: tickColor, padding: 10, usePointStyle: true, font: { size: 11 } } },
              tooltip: {
                callbacks: {
                  label: function(ctx) {
                    let total = ctx.dataset.data.reduce((a,b) => a + b, 0);
                    let pct = ((ctx.parsed / total) * 100).toFixed(1);
                    return ctx.label + ' — ' + ctx.parsed + ' (' + pct + '%)';
                  }
                }
              }
            }
          }
        });
      }

      // 4. Pipeline Distribution Bar (from Deal Status)
      if (globalData.charts.dealStatuses && globalData.charts.dealStatuses.length > 0) {
        const plCtx = document.getElementById('pipelineBarChart').getContext('2d');
        if(window.pipelineBarRef) window.pipelineBarRef.destroy();
        window.pipelineBarRef = new Chart(plCtx, {
          type: 'bar',
          data: {
            labels: globalData.charts.dealStatuses,
            datasets: [{
              label: 'Volume',
              data: globalData.charts.dealStatusData,
              backgroundColor: ['#38bdf8cc','#34d399cc','#fbbf24cc','#f87171cc','#a78bfacc','#818cf8cc','#2dd4bfcc','#fb923ccc','#e879f9cc','#60a5facc'],
              borderRadius: 6,
              borderWidth: 0
            }]
          },
          options: {
            responsive: true, maintainAspectRatio: false,
            indexAxis: 'y',
            scales: {
              x: { beginAtZero: true, grid: { color: gridColor }, ticks: { color: tickColor } },
              y: { grid: { display: false }, ticks: { color: tickColor } }
            },
            plugins: { legend: { display: false } }
          }
        });
      }
    }

    // ============== TAB 2: SALES INTELLIGENCE CHARTS ==============
    function initSalesCharts() {
      chartsInitialized.sales = true;
      if(revenueDataProcessed) {
        // Just re-render the default chart if needed
        renderDynamicRevenueChart('Total Revenue');
      }
    }

    // ============== TAB 3: EXECUTIVE OVERVIEW CHARTS ==============
    function initExecutiveCharts() {
      chartsInitialized.executive = true;
      applyExecFilters();
    }

    // ============== BUILD ACTIVE DEAL REGISTRY ==============
    let currentRegistryPage = 1;
    const REGISTRY_ITEMS_PER_PAGE = 50;

    function changeRegistryPage(delta) {
      currentRegistryPage += delta;
      if(currentRegistryPage < 1) currentRegistryPage = 1;
      buildActiveDealRegistry(false); // pass false so we don't reset to page 1
    }

    function buildActiveDealRegistry(resetPage = true) {
      if (!currentFilteredData) return;
      const tbodies = document.querySelectorAll('.deal-registry-body');
      if (tbodies.length === 0) return;
      
      let html = '';
      let recordsToRender = activeKpiFilter ? activeKpiFilteredRecords : currentFilteredData;
      
      // Live Search Filter
      const searchInput = document.getElementById('registry-search');
      const searchVal = searchInput ? searchInput.value.toLowerCase().trim() : '';
      if (searchVal) {
        recordsToRender = recordsToRender.filter(r => {
          let client = (r.clientName || '').toLowerCase();
          let code = (r.quoteCode || '').toLowerCase();
          let type = (r.type || '').toLowerCase();
          let am = (r.amName || '').toLowerCase();
          let emp = (r.employeesCount || '').toString().toLowerCase();
          return client.includes(searchVal) || code.includes(searchVal) || type.includes(searchVal) || am.includes(searchVal) || emp.includes(searchVal);
        });
      }
      
      // Volume Filter
      const minVolInput = document.getElementById('registry-min-vol');
      const maxVolInput = document.getElementById('registry-max-vol');
      const minVol = minVolInput && minVolInput.value !== '' ? parseInt(minVolInput.value) : null;
      const maxVol = maxVolInput && maxVolInput.value !== '' ? parseInt(maxVolInput.value) : null;
      
      if (minVol !== null || maxVol !== null) {
        recordsToRender = recordsToRender.filter(r => {
          let vol = r.employeesCount ? parseInt(r.employeesCount) : 0;
          if (minVol !== null && vol < minVol) return false;
          if (maxVol !== null && vol > maxVol) return false;
          return true;
        });
      }
      
      // Sort by Volume (Employees Count) Descending
      recordsToRender.sort((a, b) => {
        let volA = a.employeesCount ? parseInt(a.employeesCount) : 0;
        let volB = b.employeesCount ? parseInt(b.employeesCount) : 0;
        return volB - volA; // Descending
      });
      
      // Pagination Logic
      if (resetPage) currentRegistryPage = 1;
      const totalRecords = recordsToRender.length;
      const totalPages = Math.ceil(totalRecords / REGISTRY_ITEMS_PER_PAGE) || 1;
      
      if (currentRegistryPage > totalPages) currentRegistryPage = totalPages;
      
      const startIndex = (currentRegistryPage - 1) * REGISTRY_ITEMS_PER_PAGE;
      const endIndex = Math.min(startIndex + REGISTRY_ITEMS_PER_PAGE, totalRecords);
      const paginatedRecords = recordsToRender.slice(startIndex, endIndex);

      // Update Pagination Info UI
      const pageInfo = document.getElementById('registry-page-info');
      if (pageInfo) {
        pageInfo.textContent = `Showing ${totalRecords > 0 ? startIndex + 1 : 0} to ${endIndex} of ${totalRecords} entries`;
      }
      
      paginatedRecords.forEach((r, i) => {
        let volFormatted = r.employeesCount ? parseInt(r.employeesCount).toLocaleString('en-IN') : '—';
        html += '<tr class="border-b border-slate-800/30 hover:bg-slate-800/20 transition-colors">';
        html += '<td class="py-3 px-4 text-slate-500 text-sm font-mono">' + (r.quoteCode || 'N/A') + '</td>';
        html += '<td class="py-3 px-4 text-white font-medium truncate max-w-[200px]">' + (r.clientName || 'N/A') + '</td>';
        html += '<td class="py-3 px-4 text-slate-300 text-sm truncate max-w-[150px]">' + (r.amName || 'N/A') + '</td>';
        let s = (r.quoteStatus || 'Pending').trim();
        let sl = s.toLowerCase();
        let badgeHtml = '';
        if (sl === 'deal won') {
          badgeHtml = '<span class="text-xs px-2 py-1 bg-emerald-900/40 text-emerald-400 rounded-md border border-emerald-700/50">' + s + '</span>';
        } else if (sl === 'deal lost' || sl === 'lost' || sl === 'closed - lost') {
          badgeHtml = '<span class="text-xs px-2 py-1 bg-rose-900/40 text-rose-400 rounded-md border border-rose-700/50">' + s + '</span>';
        } else if (sl === 'negotiation' || sl === 'in negotiation') {
          badgeHtml = '<span class="text-xs px-2 py-1 bg-amber-900/40 text-amber-400 rounded-md border border-amber-700/50">' + s + '</span>';
        } else if (sl === 'quote shared') {
          badgeHtml = '<span class="text-xs px-2 py-1 bg-sky-900/40 text-sky-400 rounded-md border border-sky-700/50">' + s + '</span>';
        } else {
          badgeHtml = '<span class="text-xs px-2 py-1 bg-slate-800 text-slate-300 rounded-md border border-slate-700/50">' + s + '</span>';
        }
        
        html += '<td class="py-3 px-4">' + badgeHtml + '</td>';
        html += '<td class="py-3 px-4 text-slate-400 text-sm">' + (r.type || 'Unknown') + '</td>';
        html += '<td class="py-3 px-4 text-emerald-400 font-bold tracking-wider">' + volFormatted + '</td>';
        html += '</tr>';
      });
      
      if(html === '') html = '<tr><td colspan="6" class="text-center text-slate-500 py-8">No Active Deals Found</td></tr>';
      tbodies.forEach(tbody => tbody.innerHTML = html);
    }

    // ============== THE MAGIC FUNCTION ==============
    // Yeh function HTML Card se trigger hoga and update charts dynamically
    function updateDynamicCharts(kpiLabel, dataKey) {
      if (!globalData || !globalData.kpis) return;

      // Filter local data to recalculate sub-charts (Donut & Bar) and line chart trend
      let filtered = currentFilteredData || [];
      if (dataKey === 'dealsClosed') {
        filtered = filtered.filter(r => r.quoteStatus === 'Deal Won');
      } else if (dataKey === 'pendingQuotes') {
        filtered = filtered.filter(r => r.quoteStatus !== 'Deal Won');
      } else if (dataKey === 'dealsLost') {
        filtered = filtered.filter(r => {
          let d = r.quoteStatus ? r.quoteStatus.toLowerCase().trim() : '';
          return d === 'deal lost' || d === 'lost' || d === 'dropped' || d === 'cancelled' || d === 'closed - lost';
        });
      }

      // Line Chart Update (Real Monthly Counts for Clicked Metric)
      if(window.overallLineRef) {
        window.overallLineRef.data.datasets[0].label = kpiLabel;
        
        let sortedMonths = globalData.charts.months || [];
        let newDataArray = new Array(sortedMonths.length).fill(0);
        
        // Count actual matching deals per month
        let monthCounts = {};
        sortedMonths.forEach(m => { monthCounts[m] = 0; });
        
        currentFilteredData.forEach(r => {
          let m = r.monthYear;
          if (m && m !== "Unknown" && monthCounts[m] !== undefined) {
            let match = false;
            if (dataKey === 'totalQuotes') {
              match = true;
            } else if (dataKey === 'dealsClosed') {
              match = (r.quoteStatus === 'Deal Won');
            } else if (dataKey === 'pendingQuotes') {
              match = (r.quoteStatus !== 'Deal Won');
            } else if (dataKey === 'dealsLost') {
              let status = r.quoteStatus ? r.quoteStatus.toLowerCase().trim() : '';
              match = (status === 'deal lost' || status === 'lost' || status === 'dropped' || status === 'cancelled' || status === 'closed - lost');
            }
            
            if (match) {
              monthCounts[m]++;
            }
          }
        });
        
        for (let idx = 0; idx < sortedMonths.length; idx++) {
          newDataArray[idx] = monthCounts[sortedMonths[idx]];
        }

        // Determine active color and gradient to match card styling
        const colorMap = {
          'totalQuotes': '#38bdf8',
          'dealsClosed': '#34d399',
          'pendingQuotes': '#fbbf24',
          'dealsLost': '#f87171'
        };
        let activeColor = colorMap[dataKey] || '#38bdf8';
        
        const lineCtx = document.getElementById('trendLineChart').getContext('2d');
        let gradient = lineCtx.createLinearGradient(0, 0, 0, 400);
        let rgb = '56, 189, 248'; // default sky rgb
        if (activeColor === '#34d399') rgb = '52, 211, 153';
        else if (activeColor === '#fbbf24') rgb = '251, 191, 36';
        else if (activeColor === '#f87171') rgb = '248, 113, 113';
        
        gradient.addColorStop(0, 'rgba(' + rgb + ', 0.5)');
        gradient.addColorStop(1, 'rgba(' + rgb + ', 0)');

        window.overallLineRef.data.datasets[0].borderColor = activeColor;
        window.overallLineRef.data.datasets[0].pointBorderColor = activeColor;
        window.overallLineRef.data.datasets[0].backgroundColor = gradient;
        window.overallLineRef.data.datasets[0].data = newDataArray;
        window.overallLineRef.update();
      }

      // Update Channel Allocation Donut Chart
      if (window.channelDonutRef) {
        let typeCounts = {};
        filtered.forEach(r => {
          let t = r.type || 'Unknown';
          typeCounts[t] = (typeCounts[t] || 0) + 1;
        });
        window.channelDonutRef.data.labels = Object.keys(typeCounts);
        window.channelDonutRef.data.datasets[0].data = Object.values(typeCounts);
        window.channelDonutRef.update();
      }

      // Update Pipeline Distribution Bar Chart
      if (window.pipelineBarRef) {
        let statusCounts = {};
        filtered.forEach(r => {
          if (r.dealStatus) {
            let s = formatStatusForDisplay(r.dealStatus);
            statusCounts[s] = (statusCounts[s] || 0) + 1;
          }
        });
        window.pipelineBarRef.data.labels = Object.keys(statusCounts);
        window.pipelineBarRef.data.datasets[0].data = Object.values(statusCounts);
        window.pipelineBarRef.update();
      }
    }
    // ============== PHASE 3: QUOTEMASTER FORM FUNCTIONS ==============

    let formDropdownsLoaded = false;
    let sourceContactsData = []; // Store Source Data contacts for auto-fill

    // Load dropdown data from Google Sheet (using cache if available)
    function loadFormData() {
      if (formDropdownsLoaded && cachedDropdownData) return;
      
      if (cachedDropdownData) {
        populateFormDropdowns(cachedDropdownData);
        formDropdownsLoaded = true;
        return;
      }
      
      google.script.run
        .withSuccessHandler(function(result) {
          if (result.error) {
            console.error(result.error);
            return;
          }
          cachedDropdownData = result;
          formDropdownsLoaded = true;
          populateFormDropdowns(result);
        })
        .withFailureHandler(function(err) {
          console.error('Form dropdown load error:', err);
        })
        .getFormDropdownData();
    }

    function populateFormDropdowns(result) {
      // Store source contacts for auto-fill
      sourceContactsData = result.sourceContacts || [];

      // AM Login Restrictions: filter data for Account Managers
      let isAM = loggedInUser.role && loggedInUser.role !== 'Admin';
      let filteredContacts = sourceContactsData;
      let clientList = result.dropdowns.clients;

      if (isAM) {
        // Filter to only AM's assigned clients
        filteredContacts = sourceContactsData.filter(c => 
          isAmMatch(c.am, loggedInUser.name)
        );
        clientList = [...new Set(filteredContacts.map(c => c.clientName).filter(n => n))].sort();
      }

      // Populate Client Name datalist
      populateDatalist('dl-clients', clientList);
      populateDatalist('dl-cities', result.dropdowns.cities);

      // Build Contact Person datalist
      let contactNames = [...new Set(filteredContacts.map(c => c.contactPerson).filter(n => n))].sort();
      populateDatalist('dl-contacts', contactNames);

      // Populate select dropdowns
      populateSelect('f-am', result.dropdowns.accountManagers, 'Select AM...');
      populateSelect('f-type', result.dropdowns.types, 'Select Type...');
      populateSelect('f-requirement', result.dropdowns.requirements, 'Select Requirement...');
      populateSelect('f-sharedby', result.dropdowns.quoteSharedBy, 'Select Shared By...');

      // AM Login: Lock AM dropdown to own name
      if (isAM) {
        let amSelect = document.getElementById('f-am');
        if (amSelect) {
          amSelect.innerHTML = '<option value="' + loggedInUser.name + '" class="bg-slate-800">' + loggedInUser.name + '</option>';
          amSelect.value = loggedInUser.name;
          amSelect.disabled = true;
          amSelect.classList.add('opacity-50', 'cursor-not-allowed');
        }
      }

      // Attach auto-fill listener to Client Name field
      const clientInput = document.getElementById('f-client');
      if (clientInput) {
        clientInput.removeEventListener('input', autoFillFromSource);
        clientInput.removeEventListener('change', autoFillFromSource);
        clientInput.addEventListener('input', autoFillFromSource);
        clientInput.addEventListener('change', autoFillFromSource);
      }
    }

    // Auto-fill Contact Person, Phone, AM when Client Name is selected
    function autoFillFromSource() {
      const clientName = document.getElementById('f-client').value.trim();
      if (!clientName) return;

      // Find matching record in Source Data
      const match = sourceContactsData.find(c => c.clientName.toLowerCase() === clientName.toLowerCase());
      
      if (match) {
        // Auto-fill Contact Person
        if (match.contactPerson && !document.getElementById('f-contact').value) {
          document.getElementById('f-contact').value = match.contactPerson;
        }
        // Auto-fill Phone
        if (match.phone && !document.getElementById('f-phone').value) {
          document.getElementById('f-phone').value = match.phone;
        }
        // Auto-select Account Manager in dropdown
        if (match.am) {
          const amSelect = document.getElementById('f-am');
          for (let i = 0; i < amSelect.options.length; i++) {
            if (amSelect.options[i].value.toLowerCase() === match.am.toLowerCase()) {
              amSelect.selectedIndex = i;
              break;
            }
          }
        }

        // Show auto-fill confirmation
        showToast('\u2728 Auto-filled from Source Data: ' + match.contactPerson, 'success');
      }
    }

    function populateDatalist(dlId, values) {
      const dl = document.getElementById(dlId);
      if (!dl) return;
      dl.innerHTML = '';
      values.forEach(v => {
        let opt = document.createElement('option');
        opt.value = v;
        dl.appendChild(opt);
      });
    }

    function populateSelect(selectId, values, placeholder) {
      const sel = document.getElementById(selectId);
      if (!sel) return;
      sel.innerHTML = '<option value="" class="bg-slate-800">' + placeholder + '</option>';
      values.forEach(v => {
        let opt = document.createElement('option');
        opt.value = v;
        opt.textContent = v;
        opt.className = 'bg-slate-800';
        sel.appendChild(opt);
      });
    }

    // Submit lead to Google Sheet
    function submitLead() {
      const clientName = document.getElementById('f-client').value.trim();
      const am = document.getElementById('f-am').value;
      const type = document.getElementById('f-type').value;

      // Validation
      if (!clientName) {
        showToast('Client Name is required!', 'error');
        document.getElementById('f-client').focus();
        return;
      }
      if (!am) {
        showToast('Account Manager is required!', 'error');
        document.getElementById('f-am').focus();
        return;
      }
      if (!type) {
        showToast('Type is required!', 'error');
        document.getElementById('f-type').focus();
        return;
      }

      // Collect form data
      const formData = {
        clientName: clientName,
        emailSubject: document.getElementById('f-subject').value.trim(),
        contactPerson: document.getElementById('f-contact').value.trim(),
        contactNumber: document.getElementById('f-phone').value.trim(),
        accountManager: am,
        type: type,
        requirement: document.getElementById('f-requirement').value,
        employeesCount: document.getElementById('f-employees').value,
        quoteSharedBy: document.getElementById('f-sharedby').value,
        serviceAddress: document.getElementById('f-address').value.trim(),
        city: document.getElementById('f-city').value.trim(),
        isUrgent: document.getElementById('f-urgent').checked
      };

      // Show loading state
      const btn = document.getElementById('submit-btn');
      btn.disabled = true;
      btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin mr-1"></i>Submitting...';

      google.script.run
        .withSuccessHandler(function(result) {
          btn.disabled = false;
          btn.innerHTML = '<i class="fa-solid fa-paper-plane mr-1"></i>Submit Lead';
          
          if (result.success) {
            showToast('\u2705 Lead submitted! Quote Code: ' + result.quoteCode, 'success');
            resetForm();
            cachedLeadTableRows = null; // force fresh load
            loadLeadTable(); // Refresh the table
            // Update mini KPIs
            let leadsEl = document.getElementById('form-kpi-leads');
            if (leadsEl) leadsEl.innerText = parseInt(leadsEl.innerText || 0) + 1;
          } else {
            showToast('\u274C Error: ' + result.message, 'error');
          }
        })
        .withFailureHandler(function(err) {
          btn.disabled = false;
          btn.innerHTML = '<i class="fa-solid fa-paper-plane mr-1"></i>Submit Lead';
          showToast('\u274C Network Error: ' + err.message, 'error');
        })
        .submitNewLead(formData);
    }

    // Reset form fields
    function resetForm() {
      ['f-client','f-subject','f-contact','f-phone','f-employees','f-address','f-city'].forEach(id => {
        const el = document.getElementById(id);
        if (el) el.value = '';
      });
      ['f-am','f-type','f-requirement','f-sharedby'].forEach(id => {
        const el = document.getElementById(id);
        if (el) el.selectedIndex = 0;
      });
      document.getElementById('f-urgent').checked = false;
    }

    // Load Lead Intelligence Table (using cache if available)
    function loadLeadTable() {
      if (cachedLeadTableRows) {
        document.getElementById('lead-count-badge').innerText = cachedLeadTableTotal + ' Records';
        buildLeadTable(cachedLeadTableRows);
        return;
      }
      
      google.script.run
        .withSuccessHandler(function(result) {
          if (result.error) {
            document.getElementById('lead-table-body').innerHTML = '<tr><td colspan="9" class="text-center text-rose-400 py-6">' + result.error + '</td></tr>';
            return;
          }
          cachedLeadTableRows = result.rows;
          cachedLeadTableTotal = result.total;
          document.getElementById('lead-count-badge').innerText = result.total + ' Records';
          buildLeadTable(result.rows);
        })
        .withFailureHandler(function(err) {
          document.getElementById('lead-table-body').innerHTML = '<tr><td colspan="9" class="text-center text-rose-400 py-6">Failed to load data</td></tr>';
        })
        .getLeadTableData();
    }

    function buildLeadTable(rows) {
      const tbody = document.getElementById('lead-table-body');
      if (!rows || rows.length === 0) {
        tbody.innerHTML = '<tr><td colspan="10" class="text-center text-slate-500 py-8">No leads found</td></tr>';
        return;
      }

      // AM Login: filter leads to show only AM's own leads
      if (loggedInUser.role && loggedInUser.role !== 'Admin') {
        rows = rows.filter(r => isAmMatch(r.am, loggedInUser.name));
      }

      // Store rows for modal/filter/pagination access
      window.leadRowsCache = rows;

      // Populate filter dropdowns from data
      populateFilterDropdowns(rows);

      // Reset to page 1 and render
      currentPage = 1;
      renderPage();

      // Set initial timestamp
      updateLastSynced();
    }

    function getStatusBadge(status) {
      if (!status) return '<span class="text-slate-500">—</span>';
      let s = status.toLowerCase();
      if (s.includes('shared') || s.includes('sent')) return '<span class="px-2 py-0.5 rounded bg-sky-900/40 text-sky-300 text-[10px]">' + status + '</span>';
      if (s.includes('pending')) return '<span class="px-2 py-0.5 rounded bg-amber-900/40 text-amber-300 text-[10px]">' + status + '</span>';
      if (s.includes('draft')) return '<span class="px-2 py-0.5 rounded bg-slate-700/50 text-slate-300 text-[10px]">' + status + '</span>';
      return '<span class="px-2 py-0.5 rounded bg-slate-700/50 text-slate-400 text-[10px]">' + status + '</span>';
    }

    function getDealBadge(status) {
      if (!status) return '<span class="text-slate-500">—</span>';
      let s = status.toLowerCase();
      if (s.includes('won') || s.includes('closed') || s.includes('done') || s.includes('launched')) return '<span class="px-2 py-0.5 rounded bg-emerald-900/40 text-emerald-300 text-[10px] font-bold">' + status + '</span>';
      if (s.includes('lost') || s.includes('dropped') || s.includes('cancelled')) return '<span class="px-2 py-0.5 rounded bg-rose-900/40 text-rose-300 text-[10px]">' + status + '</span>';
      if (s.includes('pending') || s.includes('negotiation')) return '<span class="px-2 py-0.5 rounded bg-amber-900/40 text-amber-300 text-[10px]">' + status + '</span>';
      return '<span class="px-2 py-0.5 rounded bg-slate-700/50 text-slate-400 text-[10px]">' + status + '</span>';
    }

    // Toast notification
    function showToast(message, type) {
      let toast = document.createElement('div');
      let bgColor = type === 'success' ? 'bg-emerald-900/90 border-emerald-500/50 text-emerald-200' : 'bg-rose-900/90 border-rose-500/50 text-rose-200';
      toast.className = 'fixed top-6 right-6 z-[100] px-5 py-3 rounded-xl border text-sm font-medium shadow-2xl transition-all duration-500 ' + bgColor;
      toast.innerHTML = message;
      toast.style.transform = 'translateX(120%)';
      document.body.appendChild(toast);
      
      requestAnimationFrame(() => {
        toast.style.transform = 'translateX(0)';
      });
      
      setTimeout(() => {
        toast.style.transform = 'translateX(120%)';
        setTimeout(() => toast.remove(), 500);
      }, 4000);
    }

    // ============== PHASE 4: DEAL CONSOLE MODAL ==============
    let currentDealRowIndex = -1;
    let dealDropdownsLoaded = false;
    let dealDropdownData = {};

    function openDealModal(rowIndex) {
      const rows = window.leadRowsCache;
      if (!rows || !rows[rowIndex]) return;

      const r = rows[rowIndex];
      currentDealRowIndex = rowIndex;

      // Populate header info
      document.getElementById('modal-subtitle').innerText = (r.quoteCode || '—') + ' — ' + (r.client || 'Unknown');
      document.getElementById('modal-code').innerText = r.quoteCode || '—';
      document.getElementById('modal-client').innerText = r.client || '—';
      document.getElementById('modal-contact').innerText = (r.contact || '—') + (r.phone ? ' (' + r.phone + ')' : '');
      document.getElementById('modal-am').innerText = r.am || '—';

      // Fill editable fields with current values
      document.getElementById('m-remarks').value = r.remarks || '';
      document.getElementById('m-packageCode').value = r.packageCode || '';
      document.getElementById('m-packageCount').value = r.packageCount || '';
      document.getElementById('m-followupBy').value = r.followupBy || '';
      document.getElementById('m-emailReady').value = r.emailReady || '';
      document.getElementById('m-attachmentLink').value = r.attachmentLink || '';

      // Handle dates (convert "dd MMM yyyy" or "M/d/yyyy" to input date format)
      document.getElementById('m-repliedDate').value = parseDateForInput(r.quoteRepliedDate);
      document.getElementById('m-packageDate').value = parseDateForInput(r.packageDate);

      // Load dropdowns from sheet validation (once)
      if (!dealDropdownsLoaded) {
        google.script.run
          .withSuccessHandler(function(dd) {
            dealDropdownData = dd;
            dealDropdownsLoaded = true;
            populateModalDropdowns(r);
          })
          .withFailureHandler(function() {
            populateModalDropdowns(r);
          })
          .getDealDropdowns();
      } else {
        populateModalDropdowns(r);
      }

      // Show modal
      document.getElementById('deal-modal').classList.remove('hidden');
    }

    function populateModalDropdowns(rowData) {
      // Quote Status
      populateSelectWithCurrent('m-quoteStatus', dealDropdownData.quoteStatuses || [], rowData.quoteStatus);
      // Client Response
      populateSelectWithCurrent('m-clientResponse', dealDropdownData.clientResponses || [], rowData.clientResponse);
      // Deal Status
      populateSelectWithCurrent('m-dealStatus', dealDropdownData.dealStatuses || [], rowData.dealStatus);
    }

    function populateSelectWithCurrent(selectId, options, currentValue) {
      const sel = document.getElementById(selectId);
      if (!sel) return;
      
      let html = '<option value="" class="bg-slate-800">Select...</option>';
      
      // If current value exists and not in options, add it
      let allOptions = [...options];
      if (currentValue && !allOptions.map(o => o.toLowerCase()).includes(currentValue.toLowerCase())) {
        allOptions.unshift(currentValue);
      }

      allOptions.forEach(v => {
        let selected = (currentValue && v.toLowerCase() === currentValue.toLowerCase()) ? ' selected' : '';
        html += '<option value="' + v + '" class="bg-slate-800"' + selected + '>' + v + '</option>';
      });
      sel.innerHTML = html;
    }

    function parseDateForInput(dateStr) {
      if (!dateStr) return '';
      try {
        let d = new Date(dateStr);
        if (!isNaN(d.getTime())) {
          return d.toISOString().split('T')[0];
        }
      } catch(e) {}
      return '';
    }

    function closeDealModal() {
      document.getElementById('deal-modal').classList.add('hidden');
      currentDealRowIndex = -1;
    }

    function saveDealUpdate() {
      if (currentDealRowIndex < 0 || !window.leadRowsCache) return;
      
      const r = window.leadRowsCache[currentDealRowIndex];
      
      const updateData = {
        rowNumber: r.rowNumber,
        quoteStatus: document.getElementById('m-quoteStatus').value,
        quoteRepliedDate: document.getElementById('m-repliedDate').value,
        clientResponse: document.getElementById('m-clientResponse').value,
        dealStatus: document.getElementById('m-dealStatus').value,
        remarks: document.getElementById('m-remarks').value,
        packageCode: document.getElementById('m-packageCode').value,
        packageCount: document.getElementById('m-packageCount').value,
        packageDate: document.getElementById('m-packageDate').value,
        followupBy: document.getElementById('m-followupBy').value,
        emailReady: document.getElementById('m-emailReady').value,
        attachmentLink: document.getElementById('m-attachmentLink').value
      };

      // Loading state
      const btn = document.getElementById('modal-save-btn');
      btn.disabled = true;
      btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin mr-1"></i>Saving...';

      google.script.run
        .withSuccessHandler(function(result) {
          btn.disabled = false;
          btn.innerHTML = '<i class="fa-solid fa-check mr-1"></i>Save Changes';
          
          if (result.success) {
            showToast('\u2705 ' + result.message + ' (' + r.quoteCode + ')', 'success');
            closeDealModal();
            cachedLeadTableRows = null; // force fresh load
            loadLeadTable(); // Refresh table
          } else {
            showToast('\u274C ' + result.message, 'error');
          }
        })
        .withFailureHandler(function(err) {
          btn.disabled = false;
          btn.innerHTML = '<i class="fa-solid fa-check mr-1"></i>Save Changes';
          showToast('\u274C Network Error: ' + err.message, 'error');
        })
        .updateDealRow(updateData);
    }

    // ============== PHASE 5: SEARCH, FILTER & COUNTER ANIMATION ==============

    // Client-side filter for lead table
    function filterLeadTable() {
      currentPage = 1; // Reset to first page on filter change
      renderPage();
    }

    function clearFilters() {
      document.getElementById('lead-search').value = '';
      document.getElementById('filter-deal-status').selectedIndex = 0;
      document.getElementById('filter-quote-status').selectedIndex = 0;
      currentPage = 1;
      renderPage();
    }

    // Populate filter dropdowns from loaded data
    function populateFilterDropdowns(rows) {
      const dealStatuses = [...new Set(rows.map(r => r.dealStatus).filter(s => s))].sort();
      const quoteStatuses = [...new Set(rows.map(r => r.quoteStatus).filter(s => s))].sort();

      const dealSel = document.getElementById('filter-deal-status');
      const quoteSel = document.getElementById('filter-quote-status');

      dealSel.innerHTML = '<option value="" class="bg-slate-800">All Deal Status</option>';
      dealStatuses.forEach(s => {
        dealSel.innerHTML += '<option value="' + s + '" class="bg-slate-800">' + s + '</option>';
      });

      quoteSel.innerHTML = '<option value="" class="bg-slate-800">All Quote Status</option>';
      quoteStatuses.forEach(s => {
        quoteSel.innerHTML += '<option value="' + s + '" class="bg-slate-800">' + s + '</option>';
      });
    }

    // KPI Counter Animation (Optimized to update instantly to eliminate lag)
    function animateCounter(elementId, targetValue, duration, prefix = '') {
      const el = document.getElementById(elementId);
      if (!el) return;
      
      let target = parseFloat(targetValue);
      if (isNaN(target)) {
        el.innerText = prefix + targetValue;
      } else {
        let displayVal = Number.isInteger(target) ? target.toLocaleString('en-IN') : target.toLocaleString('en-IN', { minimumFractionDigits: 0, maximumFractionDigits: 2 });
        el.innerText = prefix + displayVal;
      }
    }

    // ============== PHASE 6: POWER FEATURES ==============

    // Update sidebar quick stats from KPI data
    function updateSidebarStats() {
      if (!globalData || !globalData.kpis) return;
      const k = globalData.kpis;
      document.getElementById('sidebar-total').innerText = k.totalQuotes || 0;
      document.getElementById('sidebar-won').innerText = k.dealsClosed || 0;
      document.getElementById('sidebar-pending').innerText = k.pendingQuotes || 0;
    }

    // Export lead table to CSV
    function exportToCSV() {
      const rows = window.leadRowsCache;
      if (!rows || rows.length === 0) {
        showToast('\u274C No data to export', 'error');
        return;
      }

      // Apply current filters
      const searchText = (document.getElementById('lead-search').value || '').toLowerCase().trim();
      const dealFilter = document.getElementById('filter-deal-status').value;
      const quoteFilter = document.getElementById('filter-quote-status').value;

      let dataToExport = rows;
      if (searchText || dealFilter || quoteFilter) {
        dataToExport = rows.filter(r => {
          if (searchText) {
            const combined = [r.quoteCode, r.client, r.contact, r.am, r.subject, r.type].join(' ').toLowerCase();
            if (!combined.includes(searchText)) return false;
          }
          if (dealFilter && r.dealStatus !== dealFilter) return false;
          if (quoteFilter && r.quoteStatus !== quoteFilter) return false;
          return true;
        });
      }

      // CSV Header
      const headers = ['Quote Code','Date','Client','Contact','Phone','Type','Requirement','Account Manager','Quote Status','Deal Status','Client Response','Remarks','Package Code','Followup By'];
      
      // CSV Rows
      let csv = headers.join(',') + '\n';
      dataToExport.forEach(r => {
        const row = [
          r.quoteCode, r.date, r.client, r.contact, r.phone,
          r.type, r.requirement, r.am, r.quoteStatus, r.dealStatus,
          r.clientResponse, r.remarks, r.packageCode, r.followupBy
        ].map(val => {
          // Escape commas and quotes
          let v = (val || '').toString().replace(/"/g, '""');
          return '"' + v + '"';
        });
        csv += row.join(',') + '\n';
      });

      // Download
      const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'QuoteMaster_Leads_' + new Date().toISOString().split('T')[0] + '.csv';
      a.click();
      URL.revokeObjectURL(url);

      showToast('\u2705 Exported ' + dataToExport.length + ' records to CSV', 'success');
    }

    // Keyboard Shortcuts
    document.addEventListener('keydown', function(e) {
      // Escape → close modal/sidebar
      if (e.key === 'Escape') {
        const modal = document.getElementById('deal-modal');
        if (modal && !modal.classList.contains('hidden')) {
          closeDealModal();
          return;
        }
        if (sidebarOpen && window.innerWidth < 768) {
          toggleSidebar();
        }
      }
    });

    // ============== PHASE 7: PAGINATION + SYNC + TIMESTAMP ==============
    let currentPage = 1;

    function getPerPage() {
      return parseInt(document.getElementById('rows-per-page').value) || 15;
    }

    function getFilteredRows() {
      const rows = window.leadRowsCache;
      if (!rows) return [];

      const searchText = (document.getElementById('lead-search').value || '').toLowerCase().trim();
      const dealFilter = document.getElementById('filter-deal-status').value;
      const quoteFilter = document.getElementById('filter-quote-status').value;

      if (!searchText && !dealFilter && !quoteFilter) return rows;

      return rows.filter(r => {
        if (searchText) {
          const combined = [r.quoteCode, r.client, r.contact, r.am, r.subject, r.type].join(' ').toLowerCase();
          if (!combined.includes(searchText)) return false;
        }
        if (dealFilter && r.dealStatus !== dealFilter) return false;
        if (quoteFilter && r.quoteStatus !== quoteFilter) return false;
        return true;
      });
    }

    function renderPage() {
      const allRows = window.leadRowsCache || [];
      const filtered = getFilteredRows();
      const perPage = getPerPage();
      const totalPages = Math.max(1, Math.ceil(filtered.length / perPage));

      if (currentPage > totalPages) currentPage = totalPages;
      if (currentPage < 1) currentPage = 1;

      const startIdx = (currentPage - 1) * perPage;
      const pageRows = filtered.slice(startIdx, startIdx + perPage);

      // Update badge
      const badgeText = filtered.length < allRows.length 
        ? filtered.length + ' / ' + allRows.length + ' Records' 
        : allRows.length + ' Records';
      document.getElementById('lead-count-badge').innerText = badgeText;

      // Update page info
      document.getElementById('page-info').innerText = 'Page ' + currentPage + ' of ' + totalPages;

      // Render rows
      const tbody = document.getElementById('lead-table-body');
      if (pageRows.length === 0) {
        tbody.innerHTML = '<tr><td colspan="10" class="text-center text-slate-500 py-8"><i class="fa-solid fa-filter mr-2"></i>No matching leads</td></tr>';
        return;
      }

      let html = '';
      pageRows.forEach((r, pi) => {
        const origIdx = allRows.indexOf(r);
        const displayNum = startIdx + pi + 1;
        html += '<tr class="border-b border-slate-800/50 hover:bg-slate-800/30 transition-colors cursor-pointer" ondblclick="openDealModal(' + origIdx + ')">';
        html += '<td class="py-3 px-3 text-slate-500 text-xs">' + displayNum + '</td>';
        html += '<td class="py-3 px-3 text-sky-400 font-mono text-xs font-bold">' + r.quoteCode + '</td>';
        html += '<td class="py-3 px-3 text-slate-400 text-xs">' + r.date + '</td>';
        html += '<td class="py-3 px-3 text-white text-xs font-medium truncate max-w-[150px]">' + r.client + '</td>';
        html += '<td class="py-3 px-3 text-slate-300 text-xs truncate max-w-[120px]">' + r.contact + '</td>';
        html += '<td class="py-3 px-3 text-xs"><span class="px-2 py-0.5 rounded bg-violet-900/30 text-violet-300 text-[10px]">' + (r.type || '—') + '</span></td>';
        html += '<td class="py-3 px-3 text-slate-300 text-xs">' + r.am + '</td>';
        html += '<td class="py-3 px-3 text-xs">' + getStatusBadge(r.quoteStatus) + '</td>';
        html += '<td class="py-3 px-3 text-xs">' + getDealBadge(r.dealStatus) + '</td>';
        html += '<td class="py-3 px-3 text-center"><button onclick="openDealModal(' + origIdx + ')" class="px-2.5 py-1 rounded-lg bg-sky-600/20 border border-sky-500/30 text-sky-400 text-[10px] font-bold hover:bg-sky-600/40 transition-all"><i class="fa-solid fa-pen-to-square mr-1"></i>Manage</button></td>';
        html += '</tr>';
      });
      tbody.innerHTML = html;
    }

    function goToPage(dir) {
      const filtered = getFilteredRows();
      const perPage = getPerPage();
      const totalPages = Math.max(1, Math.ceil(filtered.length / perPage));

      switch(dir) {
        case 'first': currentPage = 1; break;
        case 'prev': currentPage = Math.max(1, currentPage - 1); break;
        case 'next': currentPage = Math.min(totalPages, currentPage + 1); break;
        case 'last': currentPage = totalPages; break;
      }
      renderPage();
    }

    // (Duplicate syncDashboard removed to avoid conflicts)

    function updateLastSynced() {
      const now = new Date();
      const timeStr = now.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' });
      const dateStr = now.toLocaleDateString('en-IN', { day: '2-digit', month: 'short' });
      const el = document.getElementById('last-updated');
      if (el) el.innerHTML = '<i class="fa-regular fa-clock mr-1"></i>Last synced: ' + dateStr + ', ' + timeStr;
    }
  
