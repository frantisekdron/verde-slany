/* Load after app.js. Enhancements are additive: no existing handlers are replaced. */
(() => {
  'use strict';

  const $ = selector => document.querySelector(selector);

  // The floor plan is an alternative to the 3D scene and has its own instructions.
  const plan = $('#floorplan');
  if (plan) {
    plan.setAttribute('role', 'group');
    plan.setAttribute('aria-label', 'Interaktivní půdorys bytů');
    plan.setAttribute('aria-describedby', 'planHelp');
  }

  // A redraw removes some buttons. Keep keyboard and assistive-tech users in
  // the new view, or return them to the same save button after a list redraw.
  document.addEventListener('click', event => {
    if (event.detail !== 0) return;
    if (!(event.target instanceof Element)) return;
    const control = event.target.closest('button');
    if (!control) return;
    let target = null;
    if (control.matches('.project-choice')) target = '#explorerTitle';
    else if (control.matches('#changeProject')) target = '#selectionHeading';
    else if (control.matches('#floorButtons button')) target = () => {
      const heading = $('#planHeading');
      return heading && !heading.closest('[hidden]') ? heading : $('#floorButtons button.active');
    };
    else if (control.matches('.save-unit')) {
      const key = control.getAttribute('data-save');
      if (key) target = () => [...document.querySelectorAll('.save-unit')]
        .find(button => button.getAttribute('data-save') === key);
    }
    if (!target) return;
    requestAnimationFrame(() => {
      if (document.querySelector('dialog[open]')) return;
      const next = typeof target === 'function' ? target() : $(target);
      if (!next || next.closest('[hidden]')) return;
      if (!next.hasAttribute('tabindex') && !next.matches('button,a,input,select,textarea')) {
        next.setAttribute('tabindex', '-1');
      }
      next.focus({preventScroll:true});
    });
  });
})();
