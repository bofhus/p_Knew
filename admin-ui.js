import {
  login,
  changePassword,
  clearToken,
  getCurrentUsername,
  getToken,
  authHeaders
} from './auth.js';

function bindModalClose(modal) {
  modal.querySelectorAll('[data-close-modal="true"]').forEach((button) => {
    button.addEventListener('click', () => modal.classList.remove('open'));
  });

  modal.addEventListener('click', (event) => {
    if (event.target === modal) modal.classList.remove('open');
  });
}

export function createAdminUI({ onAdminChange, onToggleEditMode }) {
  const loginModal = document.getElementById('login-modal');
  const loginForm = document.getElementById('admin-login-form');
  const loginMessage = document.getElementById('login-message');
  const loginOpenButton = document.getElementById('open-login');

  const passwordModal = document.getElementById('change-password-modal');
  const passwordForm = document.getElementById('change-password-form');
  const passwordMessage = document.getElementById('password-message');

  const toolbar = document.getElementById('admin-toolbar');
  const editToggle = document.getElementById('toggle-edit-mode');
  const manageAdminsButton = document.getElementById('open-admins');
  const logoutButton = document.getElementById('admin-logout');

  const adminsModal = document.getElementById('admins-modal');
  const adminListBody = document.getElementById('admins-table-body');
  const createAdminForm = document.getElementById('create-admin-form');
  const adminMessage = document.getElementById('admin-message');

  let isAdmin = Boolean(getToken());
  let editMode = false;

  function setAdminState(nextAdmin) {
    isAdmin = nextAdmin;
    toolbar.classList.toggle('hidden', !isAdmin);
    loginOpenButton.classList.toggle('hidden', isAdmin);
    if (!isAdmin) {
      editMode = false;
      onToggleEditMode(false);
    }
    onAdminChange(isAdmin);
  }

  async function loadAdmins() {
    const response = await fetch('/api/admin/list', {
      headers: authHeaders()
    });

    const body = await response.json().catch(() => ({}));
    if (!response.ok) {
      throw new Error(body.message || 'Could not load admins');
    }

    const me = getCurrentUsername();
    adminListBody.innerHTML = '';
    (body.admins || []).forEach((admin) => {
      const tr = document.createElement('tr');
      tr.innerHTML = `<td>${admin.username}${admin.username === me ? ' (you)' : ''}</td>`;

      const actions = document.createElement('td');
      const delButton = document.createElement('button');
      delButton.className = 'role-button';
      delButton.type = 'button';
      delButton.textContent = 'Delete';
      delButton.disabled = admin.username === me;
      delButton.addEventListener('click', async () => {
        await deleteAdmin(admin.username);
      });

      actions.appendChild(delButton);
      tr.appendChild(actions);
      adminListBody.appendChild(tr);
    });
  }

  async function deleteAdmin(username) {
    const me = getCurrentUsername();
    if (username === me) {
      adminMessage.textContent = 'You cannot delete your own account.';
      return;
    }

    const response = await fetch(`/api/admin/${encodeURIComponent(username)}`, {
      method: 'DELETE',
      headers: authHeaders()
    });

    const body = await response.json().catch(() => ({}));
    if (!response.ok) {
      throw new Error(body.message || 'Could not delete admin');
    }

    adminMessage.textContent = `Deleted ${username}.`;
    await loadAdmins();
  }

  bindModalClose(loginModal);
  bindModalClose(passwordModal);
  bindModalClose(adminsModal);

  loginOpenButton.addEventListener('click', () => {
    loginMessage.textContent = '';
    loginForm.reset();
    loginModal.classList.add('open');
  });

  loginForm.addEventListener('submit', async (event) => {
    event.preventDefault();
    loginMessage.textContent = '';

    const username = loginForm.elements.username.value.trim();
    const password = loginForm.elements.password.value;

    try {
      const result = await login(username, password);
      loginModal.classList.remove('open');
      setAdminState(true);
      if (result.mustChangePassword) {
        passwordForm.reset();
        passwordMessage.textContent = 'Please set a new password.';
        passwordModal.classList.add('open');
      }
    } catch (error) {
      loginMessage.textContent = error.message;
    }
  });

  passwordForm.addEventListener('submit', async (event) => {
    event.preventDefault();
    const newPassword = passwordForm.elements.newPassword.value;
    const confirmPassword = passwordForm.elements.confirmPassword.value;

    if (newPassword !== confirmPassword) {
      passwordMessage.textContent = 'Passwords do not match.';
      return;
    }

    try {
      await changePassword(newPassword);
      passwordModal.classList.remove('open');
      passwordMessage.textContent = '';
    } catch (error) {
      passwordMessage.textContent = error.message;
    }
  });

  editToggle.addEventListener('click', () => {
    editMode = !editMode;
    editToggle.textContent = editMode ? 'Stop editing' : 'Edit content';
    onToggleEditMode(editMode);
  });

  manageAdminsButton.addEventListener('click', async () => {
    adminMessage.textContent = '';
    adminsModal.classList.add('open');
    try {
      await loadAdmins();
    } catch (error) {
      adminMessage.textContent = error.message;
    }
  });

  createAdminForm.addEventListener('submit', async (event) => {
    event.preventDefault();
    const username = createAdminForm.elements.username.value.trim();
    const password = createAdminForm.elements.password.value;

    const response = await fetch('/api/admin/create', {
      method: 'POST',
      headers: authHeaders({ 'Content-Type': 'application/json' }),
      body: JSON.stringify({ username, password })
    });

    const body = await response.json().catch(() => ({}));
    if (!response.ok) {
      adminMessage.textContent = body.message || 'Could not create admin.';
      return;
    }

    adminMessage.textContent = `Created admin ${username}.`;
    createAdminForm.reset();
    await loadAdmins();
  });

  logoutButton.addEventListener('click', () => {
    clearToken();
    window.location.reload();
  });

  setAdminState(isAdmin);

  return {
    isAdmin: () => isAdmin,
    isEditMode: () => editMode
  };
}
