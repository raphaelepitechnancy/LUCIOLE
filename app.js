/**
 * LUCIOLE - iPad Mockup Application JS
 * Manages the state machine, simulation of scan with Web Audio API sound effect,
 * class & student dynamic selections, countdown timer with GPU transition,
 * and optional TTS voice guides.
 */

document.addEventListener('DOMContentLoaded', () => {

  // ==========================================================================
  // APP STATE
  // ==========================================================================
  const state = {
    loginMethod: null,       // 'fc' | 'scan'
    selectedClass: null,     // '6e A', '6e B', etc.
    selectedStudent: null,   // Student name
    selectedTheme: null,     // 'Santé', 'Mal-être', etc.
    selectedOrigin: null,    // 'Observé moi-même', etc.
    voiceGuideActive: false, // Accessibility setting
    currentPageId: 'page-welcome',
    timerInterval: null,
    secondsLeft: 15
  };

  // 21 Diverse Student names
  const STUDENT_NAMES = [
    "Lucas M.", "Emma R.", "Chloé F.", "Nathan D.", "Léa V.",
    "Hugo B.", "Inès G.", "Thomas S.", "Sarah L.", "Jules K.",
    "Camille A.", "Enzo P.", "Manon T.", "Arthur H.", "Zoé C.",
    "Sofiane J.", "Jade N.", "Louis M.", "Mohamed Y.", "Alice W.",
    "Antoine B."
  ];

  // ==========================================================================
  // DOM ELEMENTS
  // ==========================================================================
  // Pages
  const pages = {
    welcome: document.getElementById('page-welcome'),
    scan: document.getElementById('page-scan'),
    classes: document.getElementById('page-classes'),
    students: document.getElementById('page-students'),
    themes: document.getElementById('page-themes'),
    origin: document.getElementById('page-origin'),
    success: document.getElementById('page-success')
  };

  // Navigation
  const btnBack = document.getElementById('btn-back');
  const appHeaderNav = document.getElementById('app-header-nav');
  const userProfileBadge = document.getElementById('user-profile-badge');
  const labelSelectedClass = document.getElementById('label-selected-class');

  // Controls & Triggers
  const btnBarcodeGo = document.getElementById('btn-barcode-go');
  const btnTriggerScan = document.getElementById('btn-trigger-scan');
  const btnDisconnect = document.getElementById('btn-disconnect');
  const btnResetDemo = document.getElementById('btn-reset-app');
  const btnToggleFrame = document.getElementById('btn-toggle-frame');
  const btnVoiceMaster = document.getElementById('btn-voice-master');

  // Containers
  const ipadWrapper = document.getElementById('ipad-wrapper');
  const studentsGridContainer = document.getElementById('students-grid-container');
  const fcModal = document.getElementById('fc-modal');
  const fcLoadingText = document.getElementById('fc-loading-text');
  const fcUserInfo = document.getElementById('fc-user-info');
  const fcSpinner = fcModal.querySelector('.fc-loading-spinner');

  // Speech & Timers
  const ttsBubble = document.getElementById('tts-bubble');
  const ttsBubbleText = ttsBubble.querySelector('.bubble-text');
  const timerProgress = document.getElementById('timer-progress');
  const timerSecondsText = document.getElementById('timer-seconds');


  // ==========================================================================
  // SCAN BEEP SOUND EFFECT (Web Audio API)
  // ==========================================================================
  function playScanBeep() {
    try {
      const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
      const oscillator = audioCtx.createOscillator();
      const gainNode = audioCtx.createGain();

      oscillator.connect(gainNode);
      gainNode.connect(audioCtx.destination);

      oscillator.type = 'sine';
      oscillator.frequency.setValueAtTime(950, audioCtx.currentTime); // 950Hz beep
      gainNode.gain.setValueAtTime(0.08, audioCtx.currentTime);
      gainNode.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + 0.18); // quick fade

      oscillator.start();
      oscillator.stop(audioCtx.currentTime + 0.18);
    } catch (e) {
      console.log("Audio API not allowed or supported by browser policy", e);
    }
  }

  // ==========================================================================
  // NAVIGATION SYSTEM
  // ==========================================================================
  function navigateTo(pageId) {
    // Hide all pages
    Object.keys(pages).forEach(key => {
      pages[key].classList.remove('active');
    });

    // Show targeted page
    const nextPage = document.getElementById(pageId);
    if (nextPage) {
      nextPage.classList.add('active');
      state.currentPageId = pageId;
    }

    // Configure Header Nav bar visibility
    if (pageId === 'page-welcome') {
      appHeaderNav.classList.add('hidden');
    } else {
      appHeaderNav.classList.remove('hidden');
    }

    // Back Button configure
    if (pageId === 'page-scan' || pageId === 'page-classes' || pageId === 'page-success') {
      // In these pages, back button behaves differently or is hidden (success)
      if (pageId === 'page-success') {
        btnBack.classList.add('hidden');
      } else {
        btnBack.classList.remove('hidden');
      }
    } else {
      btnBack.classList.remove('hidden');
    }

    // Auto Voice guide speak
    if (state.voiceGuideActive) {
      speakPageHeading(pageId);
    }
  }

  // Back button stack logic
  btnBack.addEventListener('click', () => {
    stopSpeaking();

    switch (state.currentPageId) {
      case 'page-scan':
        navigateTo('page-welcome');
        break;
      case 'page-classes':
        if (state.loginMethod === 'scan') {
          navigateTo('page-scan');
        } else {
          navigateTo('page-welcome');
        }
        break;
      case 'page-students':
        navigateTo('page-classes');
        break;
      case 'page-themes':
        navigateTo('page-students');
        break;
      case 'page-origin':
        navigateTo('page-themes');
        break;
      default:
        navigateTo('page-welcome');
    }
  });

  // ==========================================================================
  // TEXT-TO-SPEECH (TTS) ACCESSIBILITY
  // ==========================================================================
  btnVoiceMaster.addEventListener('click', () => {
    state.voiceGuideActive = !state.voiceGuideActive;

    if (state.voiceGuideActive) {
      btnVoiceMaster.classList.add('active');
      showSpeechBubble("Guide vocal activé. Je vais lire les questions pour vous.", 3000);
      speakPageHeading(state.currentPageId);
    } else {
      btnVoiceMaster.classList.remove('active');
      stopSpeaking();
      ttsBubble.classList.add('hidden');
    }
  });

  function showSpeechBubble(text, duration = 4000) {
    ttsBubbleText.textContent = text;
    ttsBubble.classList.remove('hidden');

    if (window.bubbleTimeout) {
      clearTimeout(window.bubbleTimeout);
    }

    window.bubbleTimeout = setTimeout(() => {
      ttsBubble.classList.add('hidden');
    }, duration);
  }

  function speakText(text) {
    stopSpeaking();

    if (!('speechSynthesis' in window)) {
      showSpeechBubble(text);
      return;
    }

    showSpeechBubble(text);
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = 'fr-FR';

    const voices = window.speechSynthesis.getVoices();
    const frenchVoice = voices.find(voice => voice.lang.startsWith('fr'));
    if (frenchVoice) {
      utterance.voice = frenchVoice;
    }

    utterance.pitch = 1.0;
    utterance.rate = 0.95;

    window.speechSynthesis.speak(utterance);
  }

  function stopSpeaking() {
    if ('speechSynthesis' in window) {
      window.speechSynthesis.cancel();
    }
  }

  function speakPageHeading(pageId) {
    switch (pageId) {
      case 'page-scan':
        speakText("Étape 1 : Je scanne mon code barre. Cliquez sur le badge pour simuler le scan.");
        break;
      case 'page-classes':
        speakText("Étape 2 : Jeune concerné. Sélectionnez la classe de l'élève.");
        break;
      case 'page-students':
        speakText(`Classe ${state.selectedClass}. Veuillez choisir l'élève concerné dans le trombinoscope.`);
        break;
      case 'page-themes':
        speakText("Étape 3 : Cela concerne. Sélectionnez le domaine concerné par ce signalement.");
        break;
      case 'page-origin':
        speakText("Étape 4 : Origine de l'observation. Comment avez-vous repéré ce signal faible ?");
        break;
      case 'page-success':
        speakText("Étape 5 : Merci ! Le signalement a bien été transmis. Un membre de l'équipe Luciole vient vous voir rapidement.");
        break;
    }
  }

  // Pre-load voices
  if ('speechSynthesis' in window) {
    window.speechSynthesis.getVoices();
    window.speechSynthesis.onvoiceschanged = () => {
      window.speechSynthesis.getVoices();
    };
  }

  // ==========================================================================
  // DYNAMIC STUDENT GRID GENERATOR (21 Students)
  // ==========================================================================
  // SVG avatar hairstyles
  const HAIR_STYLES = [
    // Style A: curly short hair
    (color) => `<path d="M30 35 C28 20, 72 20, 70 35 C60 22, 40 22, 30 35 Z" fill="${color}"/>`,
    // Style B: spiky hair
    (color) => `<path d="M28 32 L36 20 L44 26 L52 18 L60 26 L68 20 L72 32 Z" fill="${color}"/>`,
    // Style C: long hair
    (color) => `<path d="M28 35 C28 15 72 15 72 35 C72 45 76 60 76 60 L24 60 C24 60 28 45 28 35 Z" fill="${color}"/>`,
    // Style D: round bun
    (color) => `<circle cx="50" cy="18" r="10" fill="${color}"/><path d="M30 35 C30 20, 70 20, 70 35 Z" fill="${color}"/>`
  ];

  const SKIN_TONES = ["#ffd0a8", "#f3b283", "#e09c6f", "#c6865c", "#a2673f", "#ffd8b3"];
  const CLOTHES_COLORS = ["#38a1db", "#003366", "#ffb900", "#27ae60", "#e74c3c", "#9b59b6", "#1abc9c"];
  const HAIR_COLORS = ["#1e1b18", "#4e3629", "#8d5b4c", "#b07d62", "#d9a05b", "#65594f"];

  function generateStudentAvatar(index) {
    // Deterministic selection based on index so it is identical every time we open the page
    const hairStyleFunc = HAIR_STYLES[index % HAIR_STYLES.length];
    const skinTone = SKIN_TONES[index % SKIN_TONES.length];
    const clothesColor = CLOTHES_COLORS[(index * 3) % CLOTHES_COLORS.length];
    const hairColor = HAIR_COLORS[(index * 7) % HAIR_COLORS.length];
    const bgCircleColor = index % 2 === 0 ? "#e8f4ff" : "#fffcf0";

    return `
      <svg viewBox="0 0 100 100" width="50" height="50">
        <!-- BG circle -->
        <circle cx="50" cy="50" r="48" fill="${bgCircleColor}"/>
        
        <!-- Long hair back (if long hair style) -->
        ${(index % HAIR_STYLES.length === 2) ? hairStyleFunc(hairColor) : ''}
        
        <!-- Shirt -->
        <path d="M18 90 C18 72, 30 65, 50 65 C70 65, 82 72, 82 90 Z" fill="${clothesColor}" stroke="#003366" stroke-width="3" stroke-linejoin="round"/>
        
        <!-- Head -->
        <circle cx="50" cy="42" r="17" fill="${skinTone}" stroke="#003366" stroke-width="3"/>
        
        <!-- Hair top -->
        ${(index % HAIR_STYLES.length !== 2) ? hairStyleFunc(hairColor) : ''}
        
        <!-- Eyes -->
        <circle cx="44" cy="40" r="2" fill="#003366"/>
        <circle cx="56" cy="40" r="2" fill="#003366"/>
        
        <!-- Smile -->
        <path d="M46 48 Q50 51 54 48" fill="none" stroke="#003366" stroke-width="2" stroke-linecap="round"/>
      </svg>
    `;
  }

  function populateStudentsGrid() {
    studentsGridContainer.innerHTML = '';

    STUDENT_NAMES.forEach((name, index) => {
      const card = document.createElement('div');
      card.className = 'student-card';
      card.setAttribute('data-name', name);

      card.innerHTML = `
        <div class="student-avatar-svg">
          ${generateStudentAvatar(index)}
        </div>
        <span class="student-name">${name}</span>
      `;

      card.addEventListener('click', () => {
        state.selectedStudent = name;
        navigateTo('page-themes');
      });

      studentsGridContainer.appendChild(card);
    });
  }

  // ==========================================================================
  // LOGIN LOGIC (Page 1)
  // ==========================================================================

  // Click Code barre flow start
  btnBarcodeGo.addEventListener('click', () => {
    state.loginMethod = 'scan';
    navigateTo('page-scan');
  });

  // Click target code barre to trigger mock laser and validated scan
  btnTriggerScan.addEventListener('click', () => {
    // Play synthesis beep sound
    playScanBeep();

    // Visual flash animation
    const feed = btnTriggerScan.closest('.scanner-camera-feed');
    feed.classList.add('success-flash');

    // Wait for animation to finish then show the loading modal with teacher info
    setTimeout(() => {
      feed.classList.remove('success-flash');

      // Show loading overlay
      fcModal.classList.remove('hidden');

      // Update loader content to show the teacher avatar and name
      const loaderBody = fcModal.querySelector('.modal-body');
      loaderBody.innerHTML = `
        <div class="fc-loading-spinner"></div>
        <img src="teacher.png" class="loader-teacher-avatar" alt="Avatar Enseignant">
        <h3 class="loader-teacher-name">Mme. Sophie Martin</h3>
        <p class="loader-teacher-role">Professeur de Technologie</p>
        <p class="loading-label" style="font-weight: 800; font-size: 0.85rem; color: var(--grey-text); margin-top: 10px;">
          Connexion sécurisée en cours...
        </p>
      `;

      // Wait 2.5 seconds to simulate authentication, then redirect
      setTimeout(() => {
        fcModal.classList.add('hidden');
        userProfileBadge.classList.remove('hidden'); // Show header user badge after login
        navigateTo('page-classes');
      }, 2500);
    }, 600);
  });

  // ==========================================================================
  // CLASS SELECTION (Page 2a)
  // ==========================================================================
  document.querySelectorAll('.class-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const className = btn.getAttribute('data-class');
      state.selectedClass = className;

      // Update label and populate students
      labelSelectedClass.innerHTML = `Sélectionnez l'élève de <strong>${className}</strong> concerné`;
      populateStudentsGrid();

      navigateTo('page-students');
    });
  });

  // ==========================================================================
  // THEME SELECTION (Page 3)
  // ==========================================================================
  document.querySelectorAll('.theme-card').forEach(card => {
    card.addEventListener('click', () => {
      state.selectedTheme = card.getAttribute('data-theme');
      navigateTo('page-origin');
    });
  });

  // ==========================================================================
  // ORIGINE SELECTION (Page 4)
  // ==========================================================================
  document.querySelectorAll('.origin-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      state.selectedOrigin = btn.getAttribute('data-origin');

      // Submit and go to success screen
      showSuccessScreen();
    });
  });

  // ==========================================================================
  // SUCCESS SCREEN & AUTOLOGOUT TIMER (Page 5)
  // ==========================================================================
  function showSuccessScreen() {
    navigateTo('page-success');

    // Reset timer progress visually
    timerProgress.style.transition = 'none';
    timerProgress.style.width = '100%';

    // Wait a frame to trigger transition
    setTimeout(() => {
      timerProgress.style.transition = 'width 15s linear';
      timerProgress.style.width = '0%';
    }, 50);

    state.secondsLeft = 15;
    timerSecondsText.textContent = state.secondsLeft;

    // Clear any previous interval
    if (state.timerInterval) {
      clearInterval(state.timerInterval);
    }

    // Tick countdown
    state.timerInterval = setInterval(() => {
      state.secondsLeft--;
      timerSecondsText.textContent = state.secondsLeft;

      if (state.secondsLeft <= 0) {
        clearInterval(state.timerInterval);
        resetApplication();
        showSpeechBubble("Déconnexion automatique effectuée.", 3500);
      }
    }, 1000);
  }

  // Disconnect / "Another doubt" button -> navigate to Page 2 (classes selection)
  btnDisconnect.addEventListener('click', () => {
    if (state.timerInterval) {
      clearInterval(state.timerInterval);
    }
    state.selectedClass = null;
    state.selectedStudent = null;
    state.selectedTheme = null;
    state.selectedOrigin = null;
    navigateTo('page-classes');
  });

  // ==========================================================================
  // RESET / LOGOUT
  // ==========================================================================
  function resetApplication() {
    stopSpeaking();

    if (state.timerInterval) {
      clearInterval(state.timerInterval);
    }

    // Clear selections
    state.loginMethod = null;
    state.selectedClass = null;
    state.selectedStudent = null;
    state.selectedTheme = null;
    state.selectedOrigin = null;

    // Hide header user badge since teacher is logged out
    userProfileBadge.classList.add('hidden');

    // Go to welcome page
    navigateTo('page-welcome');
  }

  btnResetDemo.addEventListener('click', () => {
    resetApplication();
    showSpeechBubble("La démo a été réinitialisée.", 2000);
  });

  // ==========================================================================
  // EXTERNAL VIEW CONTROLS
  // ==========================================================================
  btnToggleFrame.addEventListener('click', () => {
    const isFrameHidden = ipadWrapper.classList.toggle('no-frame');
    if (isFrameHidden) {
      btnToggleFrame.textContent = "📱 Afficher le cadre iPad";
    } else {
      btnToggleFrame.textContent = "🔲 Masquer le cadre iPad";
    }
  });

});
