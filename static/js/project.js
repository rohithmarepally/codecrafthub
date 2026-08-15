      const API = '/api/courses';

      function formatDate(str) {
        if (!str) return '—';
        const d = new Date(str);
        if (isNaN(d)) return str;
        return d.toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' });
      }

      function statusClass(s) {
        if (s === 'In Progress') return 'status-in-progress';
        if (s === 'Completed')   return 'status-completed';
        return 'status-not-started';
      }

      function esc(str) {
        const d = document.createElement('div');
        d.textContent = str ?? '';
        return d.innerHTML;
      }

      function toast(msg, type = 'info') {
        const icons = { success: '✓', error: '✕', info: 'ℹ' };
        const el = document.createElement('div');
        el.className = `toast ${type}`;
        el.innerHTML = `<span class="toast-icon">${icons[type]}</span><span class="toast-msg">${esc(msg)}</span>`;
        document.getElementById('toast-container').appendChild(el);
        setTimeout(() => el.remove(), 4000);
      }

      function setLoading(btnEl, textEl, loading, label) {
        if (loading) {
          btnEl.disabled = true;
          textEl.innerHTML = '<span class="spinner"></span> ' + label;
        } else {
          btnEl.disabled = false;
          textEl.textContent = label.replace(/^.*? /, ''); // strip icon
        }
      }

      function validateFields(prefix) {
        const fields = [
          { id: `${prefix}-name`,   errId: `${prefix}-name-err`,   label: 'Course name' },
          { id: `${prefix}-desc`,   errId: `${prefix}-desc-err`,   label: 'Description' },
          { id: `${prefix}-date`,   errId: `${prefix}-date-err`,   label: 'Target date' },
          { id: `${prefix}-status`, errId: `${prefix}-status-err`, label: 'Status' },
        ];
        let valid = true;
        fields.forEach(f => {
          const el  = document.getElementById(f.id);
          const err = document.getElementById(f.errId);
          el.classList.remove('invalid');
          err.textContent = '';
          if (!el.value.trim()) {
            el.classList.add('invalid');
            err.textContent = `${f.label} is required.`;
            valid = false;
          }
        });
        return valid;
      }

      function clearErrors(prefix) {
        ['name','desc','date','status'].forEach(f => {
          const el = document.getElementById(`${prefix}-${f}`);
          const err = document.getElementById(`${prefix}-${f}-err`);
          if (el)  el.classList.remove('invalid');
          if (err) err.textContent = '';
        });
      }

      function renderCourses(courses) {
        const area = document.getElementById('courses-area');
        document.getElementById('course-count').textContent = courses.length;

        if (!courses.length) {
          area.innerHTML = `
            <div class="state-box">
              <div class="state-icon">📚</div>
              <p>No courses yet. Add one above to get started!</p>
            </div>`;
          return;
        }

        const rows = courses.map(c => `
          <tr data-id="${esc(String(c.id))}">
            <td class="name-cell"><div class="cell-clamp">${esc(c.name)}</div></td>
            <td class="desc-cell"><div class="cell-clamp">${esc(c.description)}</div></td>
            <td>${esc(c.target_date ? c.target_date.slice(0,10) : '')}</td>
            <td><span class="status-badge ${statusClass(c.status)}">${esc(c.status)}</span></td>
            <td>${formatDate(c.created_at)}</td>
            <td class="actions-cell">
              <button class="btn btn-success edit-btn" data-id="${esc(String(c.id))}">Edit</button>
              <button class="btn btn-danger delete-btn" data-id="${esc(String(c.id))}">Remove</button>
            </td>
          </tr>`).join('');

        area.innerHTML = `
          <div class="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Description</th>
                  <th>Target Date</th>
                  <th>Status</th>
                  <th>Created</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>${rows}</tbody>
            </table>
          </div>`;

        area.querySelectorAll('.edit-btn').forEach(btn =>
          btn.addEventListener('click', () => openEditModal(btn.dataset.id))
        );
        area.querySelectorAll('.delete-btn').forEach(btn =>
          btn.addEventListener('click', () => deleteCourse(btn.dataset.id, btn))
        );
      }

      async function fetchCourses() {
        const area = document.getElementById('courses-area');
        area.innerHTML = `
          <div class="state-box">
            <div><span class="spinner spinner-dark"></span></div>
            <p style="margin-top:14px">Loading courses…</p>
          </div>`;
        try {
          const res = await fetch(API);
          if (!res.ok) throw new Error(`Server error: ${res.status}`);
          const data = await res.json();
          coursesCache = Array.isArray(data) ? data : (data.courses ?? []);
          renderCourses(coursesCache);
        } catch (e) {
          area.innerHTML = `
            <div class="state-box">
              <div class="state-icon">⚠️</div>
              <p>Failed to load courses: ${esc(e.message)}</p>
            </div>`;
          toast('Could not load courses. Is the server running?', 'error');
        }
      }

      document.getElementById('add-form').addEventListener('submit', async (e) => {
        e.preventDefault();
        if (!validateFields('add')) return;

        const btn     = document.getElementById('add-btn');
        const btnText = document.getElementById('add-btn-text');
        btn.disabled  = true;
        btnText.innerHTML = '<span class="spinner"></span> Adding…';

        const body = {
          name:        document.getElementById('add-name').value.trim(),
          description: document.getElementById('add-desc').value.trim(),
          target_date: document.getElementById('add-date').value,
          status:      document.getElementById('add-status').value,
        };

        try {
          const res = await fetch(API, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(body),
          });
          if (!res.ok) {
            const err = await res.json().catch(() => ({}));
            throw new Error(err.message || err.error || `Server error: ${res.status}`);
          }
          toast('Course added successfully!', 'success');
          document.getElementById('add-form').reset();
          clearErrors('add');
          fetchCourses();
        } catch (e) {
          toast(`Failed to add course: ${e.message}`, 'error');
        } finally {
          btn.disabled = false;
          btnText.textContent = 'Add Course';
        }
      });

      document.getElementById('add-reset-btn').addEventListener('click', () => {
        document.getElementById('add-form').reset();
        clearErrors('add');
      });

      async function deleteCourse(id, btn) {
        if (!confirm('Remove this course? This cannot be undone.')) return;
        const original = btn.textContent;
        btn.disabled = true;
        btn.innerHTML = '<span class="spinner"></span>';

        try {
          const res = await fetch(`${API}/${id}`, { method: 'DELETE' });
          if (!res.ok) {
            const err = await res.json().catch(() => ({}));
            throw new Error(err.message || err.error || `Server error: ${res.status}`);
          }
          toast('Course removed.', 'success');
          fetchCourses();
        } catch (e) {
          toast(`Failed to delete course: ${e.message}`, 'error');
          btn.disabled = false;
          btn.textContent = original;
        }
      }

      let coursesCache = [];

      async function openEditModal(id) {
        let course = coursesCache.find(c => String(c.id) === String(id));
        if (!course) {
          try {
            const res = await fetch(`${API}/${id}`);
            if (!res.ok) throw new Error('Could not load course.');
            const data = await res.json();
            course = data.course;
          } catch (e) {
            toast(`Failed to load course for editing: ${e.message}`, 'error');
            return;
          }
        }

        document.getElementById('edit-id').value     = course.id;
        document.getElementById('edit-name').value   = course.name ?? '';
        document.getElementById('edit-desc').value   = course.description ?? '';
        document.getElementById('edit-date').value   = course.target_date ? course.target_date.slice(0,10) : '';
        document.getElementById('edit-status').value = course.status ?? 'Not Started';
        clearErrors('edit');
        document.getElementById('edit-modal').style.display = 'flex';
        document.getElementById('edit-name').focus();
      }

      function closeModal() {
        document.getElementById('edit-modal').style.display = 'none';
      }

      document.getElementById('modal-close').addEventListener('click', closeModal);
      document.getElementById('modal-cancel-btn').addEventListener('click', closeModal);
      document.getElementById('edit-modal').addEventListener('click', (e) => {
        if (e.target === e.currentTarget) closeModal();
      });

      document.getElementById('edit-form').addEventListener('submit', async (e) => {
        e.preventDefault();
        if (!validateFields('edit')) return;

        const id      = document.getElementById('edit-id').value;
        const btn     = document.getElementById('edit-save-btn');
        const btnText = document.getElementById('edit-btn-text');
        btn.disabled  = true;
        btnText.innerHTML = '<span class="spinner"></span> Saving…';

        const body = {
          name:        document.getElementById('edit-name').value.trim(),
          description: document.getElementById('edit-desc').value.trim(),
          target_date: document.getElementById('edit-date').value,
          status:      document.getElementById('edit-status').value,
        };

        try {
          const res = await fetch(`${API}/${id}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(body),
          });
          if (!res.ok) {
            const err = await res.json().catch(() => ({}));
            throw new Error(err.message || err.error || `Server error: ${res.status}`);
          }
          toast('Course updated successfully!', 'success');
          closeModal();
          fetchCourses();
        } catch (e) {
          toast(`Failed to update course: ${e.message}`, 'error');
        } finally {
          btn.disabled = false;
          btnText.textContent = 'Save Changes';
        }
      });

      document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') closeModal();
      });

      document.getElementById('refresh-btn').addEventListener('click', fetchCourses);

      fetchCourses();
