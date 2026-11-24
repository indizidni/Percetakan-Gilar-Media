/**
 * ============================================
 *  SECURITY MODULE — Digital Media
 *  Features: RBAC, Session Tokens, XSS Sanitization,
 *  Rate Limiting, REST API Client Bridge
 * ============================================
 */
'use strict';

const Security = (() => {
    const ROLES = Object.freeze({
        CUSTOMER: 'customer',
        CASHIER: 'cashier',
        ADMIN: 'admin'
    });

    const SESSION_KEY = 'dm_auth_session';
    const AUDIT_KEY = 'dm_security_audit';

    let _csrfToken = generateCSRFToken();

    function generateCSRFToken() {
        const array = new Uint8Array(32);
        crypto.getRandomValues(array);
        return Array.from(array, b => b.toString(16).padStart(2, '0')).join('');
    }

    function getCSRFToken() {
        return _csrfToken;
    }

    function refreshCSRFToken() {
        _csrfToken = generateCSRFToken();
        const input = document.getElementById('csrf-token');
        if (input) input.value = _csrfToken;
        return _csrfToken;
    }

    function sanitizeHTML(str) {
        if (typeof str !== 'string') return '';
        const div = document.createElement('div');
        div.appendChild(document.createTextNode(str));
        return div.innerHTML;
    }

    function sanitizeInput(input) {
        if (typeof input !== 'string') return '';
        return input
            .replace(/[<>]/g, '')
            .replace(/javascript:/gi, '')
            .replace(/on\w+\s*=/gi, '')
            .replace(/data:/gi, '')
            .trim();
    }

    function isValidPhone(phone) {
        const re = /^(?:\+62|62|0)8[1-9][0-9]{7,11}$/;
        return re.test(String(phone).replace(/[\s-]/g, ''));
    }

    function isValidEmail(email) {
        const re = /^[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)*$/;
        return re.test(email) && email.length <= 100;
    }

    // ─── Rate Limiter ───
    const _rateLimiter = {};
    function checkRateLimit(action, maxAttempts, windowMs) {
        const now = Date.now();
        if (!_rateLimiter[action]) {
            _rateLimiter[action] = { count: 1, firstAttempt: now };
            return true;
        }

        const limiter = _rateLimiter[action];
        if (now - limiter.firstAttempt > windowMs) {
            _rateLimiter[action] = { count: 1, firstAttempt: now };
            return true;
        }

        limiter.count++;
        if (limiter.count > maxAttempts) {
            logAuditEvent('RATE_LIMIT_EXCEEDED', `Action '${action}' exceeded ${maxAttempts} requests.`);
            return false;
        }
        return true;
    }

    // ─── Session Management ───
    function getActiveSession() {
        const data = safeGetStorage(SESSION_KEY);
        if (!data || !data.role) {
            return null; // No user logged in
        }
        return data;
    }

    function isCustomerLoggedIn() {
        const session = getActiveSession();
        return !!(session && session.role === ROLES.CUSTOMER && (session.userId || session.id));
    }

    function hasPermission(requiredRole) {
        const session = getActiveSession();
        if (!session || !session.role) return false;
        if (session.role === ROLES.ADMIN) return true; // Master Admin has universal access
        return session.role === requiredRole;
    }

    function setActiveSession(user) {
        if (!user) return null;
        const sessionData = {
            id: user.id || user.userId || ('USR-' + Date.now().toString(36).toUpperCase()),
            userId: user.userId || user.id || ('USR-' + Date.now().toString(36).toUpperCase()),
            role: user.role || ROLES.CUSTOMER,
            username: user.username || user.phone || 'user',
            name: user.name || user.displayName || 'Pengguna',
            phone: user.phone || '',
            email: user.email || '',
            address: user.address || '',
            timestamp: Date.now()
        };
        safeSetStorage(SESSION_KEY, sessionData);
        logAuditEvent('SESSION_LOGIN', `Logged in as [${sessionData.role}] '${sessionData.name}'`);
        return sessionData;
    }

    function clearSession() {
        localStorage.removeItem(SESSION_KEY);
        sessionStorage.removeItem(SESSION_KEY);
        logAuditEvent('LOGOUT', 'User logged out and session cleared');
    }

    function logAuditEvent(event, details) {
        const audits = safeGetStorage(AUDIT_KEY) || [];
        const entry = {
            id: 'LOG-' + Math.random().toString(36).substring(2, 8).toUpperCase(),
            time: new Date().toISOString(),
            event,
            details: sanitizeInput(details),
            role: (getActiveSession() || {}).role || 'guest'
        };
        audits.unshift(entry);
        safeSetStorage(AUDIT_KEY, audits.slice(0, 100));
    }

    function getAuditLogs() {
        return safeGetStorage(AUDIT_KEY) || [];
    }

    function safeJSONParse(str) {
        try {
            return JSON.parse(str, (key, value) => {
                if (key === '__proto__' || key === 'constructor' || key === 'prototype') {
                    return undefined;
                }
                return value;
            });
        } catch {
            return null;
        }
    }

    function safeSetStorage(key, value) {
        try {
            localStorage.setItem(key, JSON.stringify(value));
            return true;
        } catch (e) {
            console.warn('Storage set error:', e.message);
            return false;
        }
    }

    function safeGetStorage(key) {
        try {
            const item = localStorage.getItem(key);
            return item ? safeJSONParse(item) : null;
        } catch {
            return null;
        }
    }

    function generateTransactionId(prefix = 'DM') {
        const ts = Date.now().toString(36).toUpperCase();
        const rnd = Math.random().toString(36).substring(2, 6).toUpperCase();
        return `${prefix}-${ts}-${rnd}`;
    }

    return Object.freeze({
        ROLES,
        generateCSRFToken,
        getCSRFToken,
        refreshCSRFToken,
        sanitizeHTML,
        sanitizeInput,
        isValidPhone,
        isValidEmail,
        checkRateLimit,
        getActiveSession,
        isCustomerLoggedIn,
        hasPermission,
        setActiveSession,
        clearSession,
        logAuditEvent,
        getAuditLogs,
        safeJSONParse,
        safeSetStorage,
        safeGetStorage,
        generateTransactionId
    });
})();
