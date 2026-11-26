interface Env {
  DB: D1Database;
  FILES: R2Bucket;
  APP_ORIGIN: string;
  SESSION_TTL_SECONDS?: string;
  MAX_UPLOAD_BYTES?: string;
  BOOTSTRAP_OWNER_EMAIL?: string;
  BOOTSTRAP_OWNER_PASSWORD?: string;
}
type Role = 'owner' | 'editor';
type Admin = { id: string; email: string; role: Role };
const TYPES = ['Cours','Résumés','TD','TP','Examens','Corrigés','Projets','Autres'];
const json = (data: unknown, status = 200, headers: HeadersInit = {}) => new Response(JSON.stringify(data), { status, headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store', ...headers } });
const fail = (message: string, status = 400) => json({ error: message }, status);
const id = () => crypto.randomUUID();
const enc = new TextEncoder();
const b64 = (bytes: ArrayBuffer | Uint8Array) => {
  const data = bytes instanceof ArrayBuffer ? new Uint8Array(bytes) : bytes;
  return btoa(String.fromCharCode(...data))
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/,'');
};
const fromB64 = (value: string) => Uint8Array.from(atob(value.replace(/-/g,'+').replace(/_/g,'/')), c => c.charCodeAt(0));
async function digest(value: string) { return b64(await crypto.subtle.digest('SHA-256', enc.encode(value))); }
async function passwordHash(password: string, salt = b64(crypto.getRandomValues(new Uint8Array(16)))) {
  const key = await crypto.subtle.importKey('raw', enc.encode(password), 'PBKDF2', false, ['deriveBits']);
  const bits = await crypto.subtle.deriveBits({ name:'PBKDF2', salt: fromB64(salt), iterations: 310000, hash:'SHA-256' }, key, 256);
  return `pbkdf2$310000$${salt}$${b64(bits)}`;
}
async function verifyPassword(password: string, stored: string) {
  const [scheme, rounds, salt, expected] = stored.split('$');
  if (scheme !== 'pbkdf2' || !rounds || !salt || !expected) return false;
  const actual = await passwordHash(password, salt);
  return actual === `pbkdf2$${rounds}$${salt}$${expected}`;
}
async function sign(value: string, secret: string) {
  const key = await crypto.subtle.importKey('raw', enc.encode(secret), { name:'HMAC', hash:'SHA-256' }, false, ['sign']);
  return b64(await crypto.subtle.sign('HMAC', key, enc.encode(value)));
}
function cookie(request: Request, name: string) {
  return (request.headers.get('cookie') || '').split(';').map(v => v.trim()).find(v => v.startsWith(`${name}=`))?.slice(name.length + 1);
}
function secureHeaders(env: Env, request: Request) {
  const origin = request.headers.get('origin');
  if (origin && origin !== env.APP_ORIGIN) return false;
  return true;
}
async function currentAdmin(request: Request, env: Env): Promise<Admin | null> {
  const token = cookie(request, 'fsbm_session');
  if (!token) return null;
  const tokenHash = await digest(token);
  const row = await env.DB.prepare(`SELECT a.id,a.email,a.role FROM sessions s JOIN admin_users a ON a.id=s.admin_id WHERE s.token_hash=? AND s.expires_at>? AND a.active=1`).bind(tokenHash, Math.floor(Date.now()/1000)).first<Admin>();
  return row || null;
}
async function requireAdmin(request: Request, env: Env, roles: Role[] = ['owner','editor']) {
  const admin = await currentAdmin(request, env);
  if (!admin) return { error: fail('Authentification requise.', 401) };
  if (!roles.includes(admin.role)) return { error: fail('Droits insuffisants.', 403) };
  return { admin };
}
async function log(env: Env, admin: Admin | null, action: string, type: string, target: string | null, metadata?: unknown) {
  await env.DB.prepare('INSERT INTO activity_logs(id,admin_id,action,target_type,target_id,metadata) VALUES(?,?,?,?,?,?)').bind(id(),admin?.id ?? null,action,type,target,metadata ? JSON.stringify(metadata) : null).run();
}
async function bootstrap(env: Env) {
  const count = await env.DB.prepare('SELECT COUNT(*) AS n FROM admin_users').first<{n:number}>();
  if (count?.n || !env.BOOTSTRAP_OWNER_EMAIL || !env.BOOTSTRAP_OWNER_PASSWORD) return;
  if (env.BOOTSTRAP_OWNER_PASSWORD.length < 14) throw new Error('Le mot de passe initial doit contenir au moins 14 caractères.');
  await env.DB.prepare('INSERT INTO admin_users(id,email,password_hash,role) VALUES(?,?,?,?)').bind(id(),env.BOOTSTRAP_OWNER_EMAIL.toLowerCase(),await passwordHash(env.BOOTSTRAP_OWNER_PASSWORD),'owner').run();
}
async function handle(request: Request, env: Env): Promise<Response> {
  const url = new URL(request.url); const path = url.pathname.replace(/\/$/,'') || '/'; const method = request.method;
  if (method === 'OPTIONS') return new Response(null,{status:204,headers:{'access-control-allow-origin':env.APP_ORIGIN,'access-control-allow-methods':'GET,POST,PUT,DELETE,OPTIONS','access-control-allow-headers':'Content-Type','access-control-allow-credentials':'true','vary':'Origin'}});
  if (!secureHeaders(env,request)) return fail('Origine non autorisée.',403);
  if (!['GET','HEAD','OPTIONS'].includes(method) && !request.headers.get('origin')) return fail('En-tête Origin obligatoire.',403);
  try {
    await bootstrap(env);
    if (path === '/api/health' && method === 'GET') return json({status:'ok',service:'fsbm-library-api'});
    if (path === '/api/catalogue' && method === 'GET') {
      const programme = await env.DB.prepare('SELECT id,name,slug FROM programmes WHERE active=1 LIMIT 1').first<{id:string,name:string,slug:string}>();
      if (!programme) return json({programme:null,semesters:[]});
      const semesters = await env.DB.prepare('SELECT s.id,s.number,s.label,COUNT(DISTINCT m.id) AS module_count,COUNT(r.id) AS resource_count FROM semesters s LEFT JOIN modules m ON m.semester_id=s.id LEFT JOIN resources r ON r.module_id=m.id AND r.status=\'published\' WHERE s.programme_id=? GROUP BY s.id ORDER BY s.number').bind(programme?.id).all();
      return json({programme,semesters:semesters.results});
    }
    if (path === '/api/modules' && method === 'GET') {
      const semester = Number(url.searchParams.get('semester'));
      if (!Number.isInteger(semester) || semester < 1 || semester > 6) return fail('Semestre invalide.');
      const rows = await env.DB.prepare(`SELECT m.id,m.name,m.code,m.description,COUNT(r.id) resource_count FROM modules m JOIN semesters s ON s.id=m.semester_id LEFT JOIN resources r ON r.module_id=m.id AND r.status='published' WHERE s.number=? AND s.programme_id='informatique-appliquee' GROUP BY m.id ORDER BY m.name`).bind(semester).all();
      return json({modules:rows.results});
    }
    if (path === '/api/resources' && method === 'GET') {
      const q = (url.searchParams.get('q') || '').trim().slice(0,100); const semester = url.searchParams.get('semester'); const moduleId = url.searchParams.get('module'); const type = url.searchParams.get('type');
      const rows = await env.DB.prepare(`SELECT r.id,r.title,r.description,r.type,r.file_name,r.mime_type,r.size_bytes,r.academic_year,r.downloads,r.created_at,m.id module_id,m.name module_name,m.code,s.number semester_number,p.name programme_name FROM resources r JOIN modules m ON m.id=r.module_id JOIN semesters s ON s.id=m.semester_id JOIN programmes p ON p.id=s.programme_id WHERE r.status='published' AND (?='' OR r.title LIKE '%'||?||'%' OR r.description LIKE '%'||?||'%' OR m.name LIKE '%'||?||'%') AND (? IS NULL OR s.number=?) AND (? IS NULL OR m.id=?) AND (? IS NULL OR r.type=?) ORDER BY s.number,m.name,r.type,r.title LIMIT 200`).bind(q,q,q,q,semester,semester,moduleId,moduleId,type,type).all();
      return json({resources:rows.results});
    }
    if (path === '/api/requests' && method === 'POST') {
      const body = await request.json() as Record<string,string>;
      const moduleName = (body.moduleName || '').trim().slice(0,120); const title = (body.title || '').trim().slice(0,160); const resourceType = body.resourceType || 'Autres';
      if (!moduleName || !title || !TYPES.includes(resourceType)) return fail('Veuillez renseigner le module, le document et un type valide.');
      if (title.length < 3 || moduleName.length < 2) return fail('Les informations fournies sont trop courtes.');
      const contact = (body.contact || '').trim().slice(0,160); const details = (body.details || '').trim().slice(0,1000);
      const semesterNumber = Number(body.semester); if (body.semester && (!Number.isInteger(semesterNumber) || semesterNumber < 1 || semesterNumber > 6)) return fail('Semestre invalide.');
      const requester = await digest(request.headers.get('cf-connecting-ip') || 'unknown'); const now = Math.floor(Date.now()/1000);
      const recent = await env.DB.prepare("SELECT COUNT(*) n FROM login_attempts WHERE identity=? AND attempted_at>?").bind(`request:${requester}`,now-3600).first<{n:number}>();
      if ((recent?.n || 0) >= 5) return fail('Trop de demandes depuis cette connexion. Réessayez plus tard.',429);
      await env.DB.prepare('INSERT INTO login_attempts(id,identity,attempted_at) VALUES(?,?,?)').bind(id(),`request:${requester}`,now).run();
      const requestId = id(); await env.DB.prepare('INSERT INTO resource_requests(id,programme_id,semester_number,module_name,resource_type,title,details,contact) VALUES(?,?,?,?,?,?,?,?)').bind(requestId,'informatique-appliquee',semesterNumber||null,moduleName,resourceType,title,details || null,contact || null).run();
      return json({message:'Votre demande a bien été transmise.',id:requestId},201);
    }
    if (path === '/api/admin/login' && method === 'POST') {
      const body = await request.json() as {email?:string,password?:string}; const email = (body.email || '').trim().toLowerCase(); const password = body.password || ''; const ip = request.headers.get('cf-connecting-ip') || 'unknown'; const identity = await digest(`${ip}:${email}`); const now = Math.floor(Date.now()/1000);
      await env.DB.prepare('DELETE FROM login_attempts WHERE attempted_at<?').bind(now-3600).run();
      const attempts = await env.DB.prepare('SELECT COUNT(*) n FROM login_attempts WHERE identity=? AND attempted_at>?').bind(identity,now-900).first<{n:number}>();
      if ((attempts?.n || 0) >= 8) return fail('Trop de tentatives. Réessayez dans 15 minutes.',429);
      await env.DB.prepare('INSERT INTO login_attempts(id,identity,attempted_at) VALUES(?,?,?)').bind(id(),identity,now).run();
      const admin = await env.DB.prepare('SELECT id,email,role,password_hash FROM admin_users WHERE email=? AND active=1').bind(email).first<{id:string,email:string,role:Role,password_hash:string}>();
      if (!admin || !(await verifyPassword(password,admin.password_hash))) return fail('Identifiants incorrects.',401);
      await env.DB.prepare('DELETE FROM login_attempts WHERE identity=?').bind(identity).run();
      const token = b64(crypto.getRandomValues(new Uint8Array(32))); const ttl = Number(env.SESSION_TTL_SECONDS || 43200); const expires = now+ttl;
      await env.DB.prepare('INSERT INTO sessions(id,admin_id,token_hash,expires_at) VALUES(?,?,?,?)').bind(id(),admin.id,await digest(token),expires).run();
      await env.DB.prepare('UPDATE admin_users SET last_login=CURRENT_TIMESTAMP WHERE id=?').bind(admin.id).run();
      await log(env,{id:admin.id,email:admin.email,role:admin.role},'login','session',null);
      return json({admin:{id:admin.id,email:admin.email,role:admin.role}},200,{'set-cookie':`fsbm_session=${token}; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=${ttl}`});
    }
    if (path === '/api/admin/logout' && method === 'POST') {
      const token = cookie(request,'fsbm_session'); if (token) await env.DB.prepare('DELETE FROM sessions WHERE token_hash=?').bind(await digest(token)).run();
      return json({message:'Session fermée.'},200,{'set-cookie':'fsbm_session=; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=0'});
    }
    if (path.startsWith('/api/admin/')) {
      const auth = await requireAdmin(request,env); if (auth.error) return auth.error; const admin = auth.admin!;
      if (path === '/api/admin/me' && method === 'GET') return json({admin});
      if (path === '/api/admin/overview' && method === 'GET') {
        const [resources,requests,modules,admins] = await Promise.all([
          env.DB.prepare('SELECT COUNT(*) n FROM resources').first<{n:number}>(),env.DB.prepare("SELECT COUNT(*) n FROM resource_requests WHERE status='new'").first<{n:number}>(),env.DB.prepare('SELECT COUNT(*) n FROM modules').first<{n:number}>(),admin.role==='owner'?env.DB.prepare('SELECT id,email,role,active,created_at,last_login FROM admin_users ORDER BY created_at').all():Promise.resolve({results:[]})
        ]);
        return json({resources:resources?.n||0,newRequests:requests?.n||0,modules:modules?.n||0,admins:admins.results});
      }
      if (path === '/api/admin/resources' && method === 'GET') {
        const rows = await env.DB.prepare('SELECT r.id,r.title,r.description,r.type,r.file_name,r.size_bytes,r.academic_year,r.status,r.created_at,m.id module_id,m.name module_name,s.number semester_number FROM resources r JOIN modules m ON m.id=r.module_id JOIN semesters s ON s.id=m.semester_id ORDER BY r.created_at DESC LIMIT 300').all(); return json({resources:rows.results});
      }
      if (path === '/api/admin/modules' && method === 'GET') {
        const rows = await env.DB.prepare('SELECT m.id,m.name,m.code,m.description,s.number semester_number,s.label semester_label FROM modules m JOIN semesters s ON s.id=m.semester_id ORDER BY s.number,m.name').all(); return json({modules:rows.results});
      }
      if (path === '/api/admin/modules' && method === 'POST') {
        const body = await request.json() as {semesterId:string,name:string,code?:string,description?:string}; if (!body.name?.trim() || !body.semesterId) return fail('Nom et semestre obligatoires.');
        const moduleId=id(); await env.DB.prepare('INSERT INTO modules(id,semester_id,name,code,description) VALUES(?,?,?,?,?)').bind(moduleId,body.semesterId,body.name.trim().slice(0,140),body.code?.trim().slice(0,30)||null,body.description?.trim().slice(0,500)||null).run(); await log(env,admin,'create','module',moduleId); return json({id:moduleId},201);
      }
      if (path === '/api/admin/resources' && method === 'POST') {
        const body = await request.json() as {moduleId:string,title:string,description?:string,type:string,academicYear?:string}; if (!body.moduleId || !body.title?.trim() || !TYPES.includes(body.type)) return fail('Métadonnées de ressource invalides.');
        const resourceId=id(); await env.DB.prepare('INSERT INTO resources(id,module_id,title,description,type,object_key,file_name,mime_type,size_bytes,sha256,academic_year,status,created_by) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?)').bind(resourceId,body.moduleId,body.title.trim().slice(0,160),body.description?.slice(0,1000)||null,body.type,`pending/${resourceId}`,'pending','application/octet-stream',0,'pending',body.academicYear||null,'draft',admin.id).run(); return json({id:resourceId,uploadUrl:`/api/admin/resources/${resourceId}/file`},201);
      }
      const uploadMatch = path.match(/^\/api\/admin\/resources\/([\w-]+)\/file$/);
      if (uploadMatch && method === 'PUT') {
        const resourceId=uploadMatch[1]; const max=Number(env.MAX_UPLOAD_BYTES||15728640); const contentType=request.headers.get('content-type')||''; const filename=decodeURIComponent(url.searchParams.get('filename')||'document.pdf').slice(0,180);
        if (!contentType.toLowerCase().includes('application/pdf')) return fail('Seuls les fichiers PDF sont acceptés.'); if (!request.body) return fail('Fichier manquant.');
        const bytes=await request.arrayBuffer(); if (!bytes.byteLength || bytes.byteLength>max) return fail(`Le fichier doit peser moins de ${Math.round(max/1048576)} Mo.`);
        const data=new Uint8Array(bytes); if (new TextDecoder().decode(data.slice(0,5)) !== '%PDF-') return fail('Le fichier transmis n’est pas un PDF valide.');
        const hash=b64(await crypto.subtle.digest('SHA-256',data)); const objectKey=`resources/${resourceId}/${id()}.pdf`; const old=await env.DB.prepare('SELECT object_key FROM resources WHERE id=?').bind(resourceId).first<{object_key:string}>(); if (!old) return fail('Ressource introuvable.',404);
        await env.FILES.put(objectKey,data,{httpMetadata:{contentType:'application/pdf',cacheControl:'public, max-age=3600'},customMetadata:{sha256:hash,originalName:filename}});
        await env.DB.prepare("UPDATE resources SET object_key=?,file_name=?,mime_type='application/pdf',size_bytes=?,sha256=?,status='draft',updated_at=CURRENT_TIMESTAMP WHERE id=?").bind(objectKey,filename,data.byteLength,hash,resourceId).run(); if (old.object_key!=='pending/'+resourceId) await env.FILES.delete(old.object_key); return json({message:'Fichier téléversé.',size:bytes.byteLength,sha256:hash});
      }
      const resourceMatch=path.match(/^\/api\/admin\/resources\/([\w-]+)$/);
      if (resourceMatch && method==='PUT') {
        const body=await request.json() as {title?:string,description?:string,type?:string,status?:string,academicYear?:string}; if (body.type && !TYPES.includes(body.type)) return fail('Type invalide.'); if (body.status && !['draft','published','archived'].includes(body.status)) return fail('Statut invalide.');
        const row=await env.DB.prepare('SELECT object_key,size_bytes FROM resources WHERE id=?').bind(resourceMatch[1]).first<{object_key:string,size_bytes:number}>(); if (!row) return fail('Ressource introuvable.',404); if (body.status==='published' && (row.object_key.startsWith('pending/') || row.size_bytes===0)) return fail('Ajoutez un PDF avant de publier.');
        await env.DB.prepare('UPDATE resources SET title=COALESCE(?,title),description=COALESCE(?,description),type=COALESCE(?,type),status=COALESCE(?,status),academic_year=COALESCE(?,academic_year),updated_at=CURRENT_TIMESTAMP WHERE id=?').bind(body.title?.trim().slice(0,160)||null,body.description?.slice(0,1000)??null,body.type||null,body.status||null,body.academicYear||null,resourceMatch[1]).run(); await log(env,admin,'update','resource',resourceMatch[1],body); return json({message:'Ressource mise à jour.'});
      }
      if (resourceMatch && method==='DELETE') {
        if (admin.role!=='owner') return fail('Seul le propriétaire peut supprimer une ressource.',403); const row=await env.DB.prepare('SELECT object_key,status FROM resources WHERE id=?').bind(resourceMatch[1]).first<{object_key:string,status:string}>(); if (!row) return fail('Ressource introuvable.',404); if (row.status!=='archived') return fail('Archivez la ressource avant sa suppression définitive.'); await env.FILES.delete(row.object_key); await env.DB.prepare('DELETE FROM resources WHERE id=?').bind(resourceMatch[1]).run(); await log(env,admin,'delete','resource',resourceMatch[1]); return json({message:'Ressource supprimée.'});
      }
      if (path === '/api/admin/requests' && method==='GET') { const rows=await env.DB.prepare('SELECT * FROM resource_requests ORDER BY CASE status WHEN \'new\' THEN 0 ELSE 1 END,created_at DESC LIMIT 300').all(); return json({requests:rows.results}); }
      const requestMatch=path.match(/^\/api\/admin\/requests\/([\w-]+)$/);
      if (requestMatch && method==='PUT') { const body=await request.json() as {status:string}; if (!['new','in_progress','completed','rejected'].includes(body.status)) return fail('Statut invalide.'); await env.DB.prepare('UPDATE resource_requests SET status=?,updated_at=CURRENT_TIMESTAMP WHERE id=?').bind(body.status,requestMatch[1]).run(); await log(env,admin,'update','request',requestMatch[1],body); return json({message:'Demande mise à jour.'}); }
      if (path === '/api/admin/users' && method==='POST') {
        if (admin.role!=='owner') return fail('Réservé au propriétaire.',403); const body=await request.json() as {email:string,password:string,role:Role}; if (!/^\S+@\S+\.\S+$/.test(body.email)||body.password.length<14||!['owner','editor'].includes(body.role)) return fail('Adresse, mot de passe (14 caractères minimum) ou rôle invalide.'); const userId=id(); await env.DB.prepare('INSERT INTO admin_users(id,email,password_hash,role) VALUES(?,?,?,?)').bind(userId,body.email.toLowerCase(),await passwordHash(body.password),body.role).run(); await log(env,admin,'create','admin',userId,{email:body.email,role:body.role}); return json({id:userId},201);
      }
      if (path === '/api/admin/users' && method==='GET' && admin.role==='owner') { const rows=await env.DB.prepare('SELECT id,email,role,active,created_at,last_login FROM admin_users ORDER BY created_at').all(); return json({users:rows.results}); }
      return fail('Route introuvable.',404);
    }
    const download=path.match(/^\/api\/download\/([\w-]+)$/);
    if (download && method==='GET') {
      const row=await env.DB.prepare("SELECT object_key,file_name FROM resources WHERE id=? AND status='published'").bind(download[1]).first<{object_key:string,file_name:string}>(); if (!row) return fail('Document introuvable.',404); const object=await env.FILES.get(row.object_key); if (!object) return fail('Fichier indisponible.',404); await env.DB.prepare('UPDATE resources SET downloads=downloads+1 WHERE id=?').bind(download[1]).run(); return new Response(object.body,{headers:{'content-type':'application/pdf','content-disposition':`attachment; filename*=UTF-8''${encodeURIComponent(row.file_name)}`,'cache-control':'private, max-age=0','x-content-type-options':'nosniff'}});
    }
    return fail('Route introuvable.',404);
  } catch (error) { console.error(error); return fail('Une erreur interne est survenue.',500); }
}
export default { fetch: async (request: Request, env: Env, ctx: ExecutionContext) => {
  const response = await handle(request, env);
  const headers = new Headers(response.headers);
  headers.set('access-control-allow-origin', env.APP_ORIGIN);
  headers.set('access-control-allow-credentials', 'true');
  headers.set('vary', 'Origin');
  headers.set('x-content-type-options', 'nosniff');
  headers.set('referrer-policy', 'strict-origin-when-cross-origin');
  return new Response(response.body, { status: response.status, statusText: response.statusText, headers });
} } satisfies ExportedHandler<Env>;
