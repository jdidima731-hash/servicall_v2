#!/usr/bin/env python3
"""
Script d'initialisation admin direct via psql
Crée le compte admin et le tenant par défaut
"""
import subprocess
import hashlib
import os
import sys
import secrets
import string

def run_sql(sql, db_url="postgresql://servicall_user:servicall_pass_2024@localhost:5432/servicall_db"):
    """Exécuter une requête SQL via psql"""
    result = subprocess.run(
        ["psql", db_url, "-c", sql, "-t", "-A"],
        capture_output=True, text=True
    )
    return result.stdout.strip(), result.returncode

def bcrypt_hash(password):
    """Générer un hash bcrypt via Python"""
    try:
        import bcrypt
        return bcrypt.hashpw(password.encode(), bcrypt.gensalt(12)).decode()
    except ImportError:
        # Fallback: utiliser node pour bcrypt
        result = subprocess.run(
            ["node", "-e", f"""
const bcrypt = require('bcryptjs');
bcrypt.hash('{password}', 12).then(h => process.stdout.write(h));
"""],
            capture_output=True, text=True,
            cwd="/home/ubuntu/servicall"
        )
        return result.stdout.strip()

def main():
    admin_email = os.environ.get("ADMIN_EMAIL", "admin@servicall.local")
    admin_password = os.environ.get("ADMIN_PASSWORD", "Admin@Servicall2024!")
    admin_name = os.environ.get("ADMIN_NAME", "Administrateur Servicall")
    
    print(f"\n🔧 Initialisation du compte admin: {admin_email}")
    
    # Vérifier si l'admin existe déjà
    check_sql = f"SELECT COUNT(*) FROM users WHERE email = '{admin_email}';"
    output, code = run_sql(check_sql)
    
    if output and output.strip() != "0":
        print(f"✅ Administrateur existant détecté: {admin_email}")
        print("Aucune action nécessaire.\n")
        return
    
    # Générer le hash du mot de passe
    print("🔐 Génération du hash du mot de passe...")
    password_hash = bcrypt_hash(admin_password)
    
    if not password_hash:
        print("❌ Erreur lors du hash du mot de passe")
        sys.exit(1)
    
    # Générer un openId unique
    open_id = ''.join(secrets.choice(string.ascii_letters + string.digits) for _ in range(21))
    
    # Créer l'utilisateur admin
    insert_user_sql = f"""
INSERT INTO users (open_id, email, name, password_hash, login_method, role, last_signed_in)
VALUES ('{open_id}', '{admin_email}', '{admin_name}', '{password_hash}', 'password', 'admin', NOW())
RETURNING id;
"""
    output, code = run_sql(insert_user_sql)
    
    if code != 0 or not output:
        print(f"❌ Erreur lors de la création de l'admin: {output}")
        sys.exit(1)
    
    admin_id = output.strip()
    print(f"✅ Administrateur créé (ID: {admin_id})")
    
    # Créer ou récupérer le tenant par défaut
    check_tenant_sql = "SELECT id FROM tenants WHERE slug = 'default' LIMIT 1;"
    tenant_output, _ = run_sql(check_tenant_sql)
    
    if tenant_output:
        tenant_id = tenant_output.strip()
        print(f"✅ Tenant existant récupéré (ID: {tenant_id})")
    else:
        insert_tenant_sql = """
INSERT INTO tenants (slug, name, is_active, settings)
VALUES ('default', 'ServiceCall Default', true, '{}')
RETURNING id;
"""
        tenant_output, code = run_sql(insert_tenant_sql)
        if code != 0 or not tenant_output:
            print(f"⚠️ Avertissement: Impossible de créer le tenant: {tenant_output}")
            tenant_id = None
        else:
            tenant_id = tenant_output.strip()
            print(f"✅ Tenant par défaut créé (ID: {tenant_id})")
    
    # Lier l'admin au tenant
    if tenant_id:
        link_sql = f"""
INSERT INTO tenant_users (user_id, tenant_id, role, is_active)
VALUES ({admin_id}, {tenant_id}, 'owner', true)
ON CONFLICT (user_id, tenant_id) DO NOTHING;
"""
        _, code = run_sql(link_sql)
        if code == 0:
            print(f"✅ Admin lié au tenant {tenant_id}")
    
    print(f"\n🎉 Initialisation terminée!")
    print(f"   Email    : {admin_email}")
    print(f"   Mot de passe : {admin_password}")
    print(f"   Rôle     : admin\n")

if __name__ == "__main__":
    main()
