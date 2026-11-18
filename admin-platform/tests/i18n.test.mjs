import test from 'node:test';
import assert from 'node:assert/strict';
import {t,adminLanguage,adminLocale,setAdminLanguage} from '../i18n.ts';

test('administration starts in Czech and explicitly switches without changing source identifiers',()=>{
 assert.equal(adminLanguage(),'cs');assert.equal(adminLocale(),'cs-CZ');
 assert.equal(t('Sign in'),'Přihlásit se');assert.equal(t('Prices and reservations'),'Ceny a rezervace');
 assert.equal(t('Incorrect email or password, or access is inactive.'),'Nesprávný e-mail nebo heslo, případně neaktivní přístup.');
 assert.equal(t('{0} unsaved changes',3),'Neuložené změny: 3');
 assert.equal(t('This file is used in: news/test.jpg. Remove those references first.'),'Soubor se používá v: news/test.jpg. Nejprve ho z těchto míst odeberte.');
 assert.equal(t('reserved'),'reserved');assert.equal(t('content_manager'),'content_manager');
 const initialLabel=t('Media library');setAdminLanguage('en');assert.equal(t(initialLabel),'Media library');assert.equal(t('Publish article'),'Publish article');
 assert.equal(adminLocale(),'en-GB');setAdminLanguage('cs');assert.equal(t('Publish article'),'Zveřejnit článek');
});
