#------------------------------------------------------------------------------------------------------------------------------------------//
#------------------------------------------------------------------------------------------------------------------------------------------//
#---------------------- Nome: LM PreCad2 checkCPF.py
#------------------- Doctype: LM PreCad2
#----------------- Descricao: Verifica se um CPF já existe em Customer
#------------------ Contexto: Pré Cadastro de um usuário na etapa de Inscrições
#---------------------- Data: 27/07/2024
#--------------------- Autor: Eduardo Kuniyoshi (EK)
#--- Histórico de alterações:
#----------------------------  1.0 - EK - 27/07/2024 - Liberação da versão para o processo de inscrição 2o. Sem/2024
#----------------------------  2.0 - EK - 13/06/2025 - Refactoring
#----------------------------  2.1 - EK - 16/06/2025 - Correções de bugs
#----------------------------  2.2 - EK - 18/06/2025 - Correção do retorno da resposta
#------------------------------------------------------------------------------------------------------------------------------------------//
#------------------------------------------------------------------------------------------------------------------------------------------//

#import json
#import re
#import frappe

frappe.log_error("DEBUG: checkCPF ")
#@frappe.whitelist()
def checkCPF(args):
    frappe.log_error("início de checkCPF ", "checkCPF Error")
    frappe.db.commit()  # ← Força salvar o log
    """
    Verifica se um cliente existe baseado no CPF
    
    Args:
        args: Objeto contendo parâmetro 'doc' com string JSON contendo campo 'cpf'
        
    Returns:
        dict: Resposta com:
        - ok: boolean indicando se o cliente existe
        - doc: dicionário do documento do cliente se encontrado, dict vazio caso contrário
        - erro: mensagem de erro se houver
    """
    try:
        # Verificar se args e args.doc existem
        
        if not hasattr(args, 'doc') or not args.doc:
            response = {
                "ok": False, 
                "doc": {}, 
                "erro": "Parâmetro 'doc' é obrigatório"
            }
            frappe.response['message'] = response
            return response
        
        # Fazer parse do documento JSON
        try:
            dict_doc = json.loads(args.doc)
        except json.JSONDecodeError as e:
            response = {
                "ok": False,
                "doc": {},
                "erro": f"Formato JSON inválido: {str(e)}"
            }
            frappe.response['message'] = response
            frappe.log_error(f"Erro de decode JSON em checkCPF: {e}", "checkCPF Error")
            return response
        
        # Validar campos obrigatórios
        if not dict_doc.get("cpf"):
            response = {
                "ok": False, 
                "doc": {}, 
                "erro": "CPF é obrigatório"
            }
            frappe.response['message'] = response
            return response
            
        cpf = dict_doc["cpf"].strip()
        
        # Validar formato do CPF antes de buscar no banco
        if not validar_cpf(cpf):
            response = {
                "ok": False,
                "doc": {},
                "erro": "CPF inválido"
            }
            frappe.response['message'] = response
            return response
        
        # Limpar CPF para busca (remover formatação)
        cpf_limpo = re.sub(r'[^0-9]', '', cpf)
        
        frappe.log_error(str(cpf_limpo), "checkCPF")
        frappe.logger().info(f"checkCPF - Buscando CPF: {cpf_limpo}")
        
        
        # Buscar cliente pelo CPF - versão otimizada
        customer_name = buscar_cliente_por_cpf(cpf_limpo)
        
        if customer_name:
            # Cliente existe, buscar documento completo
            try:
                doc_cliente = frappe.get_doc("Customer", customer_name)
                response = {
                    "ok": True,
                    "doc": doc_cliente.as_dict()
                }
                frappe.response['message'] = response
                return response
            except frappe.DoesNotExistError:
                response = {
                    "ok": False,
                    "doc": {},
                    "erro": "Cliente não encontrado"
                }
                frappe.response['message'] = response
                return response
        else:
            # Cliente não existe
            response = {
                "ok": False,
                "doc": {}
            }
            frappe.response['message'] = response
            return response
            
    except Exception as e:
        mensagem_erro = f"Erro ao verificar CPF: {str(e)}"
        response = {
            "ok": False,
            "doc": {},
            "erro": mensagem_erro
        }
        frappe.response['message'] = response
        frappe.log_error(f"Erro em checkCPF: {e}", "checkCPF Error")
        return response

def buscar_cliente_por_cpf(cpf_limpo):
    """
    Busca cliente por CPF com tentativas de formatação diferente
    
    Args:
        cpf_limpo: CPF apenas com números
        
    Returns:
        str: Nome do cliente se encontrado, None caso contrário
    """
    frappe.log_error(str(cpf_limpo), "buscar_cliente_por_cpf")
    # Primeiro tenta buscar com CPF limpo
    customer_name = frappe.db.get_value("Customer", {"tax_id": cpf_limpo}, "name")
    
    # Se não encontrar, tenta com CPF formatado
    if not customer_name:
        cpf_formatado = format_cpf(cpf_limpo)
        customer_name = frappe.db.get_value("Customer", {"tax_id": cpf_formatado}, "name")
    
    return customer_name

def validar_cpf(cpf):
    """
    Valida formato do CPF brasileiro e dígito verificador
    
    Args:
        cpf: String do CPF para validar
        
    Returns:
        bool: True se CPF é válido, False caso contrário
    """
    if not cpf:
        return False
        
    # Remove caracteres não numéricos
    cpf = re.sub(r'[^0-9]', '', cpf)
    
    # Verifica se CPF tem 11 dígitos
    if len(cpf) != 11:
        return False
        
    # Verifica CPFs inválidos conhecidos (todos os dígitos iguais)
    cpfs_invalidos = [str(i) * 11 for i in range(10)]
    if cpf in cpfs_invalidos:
        return False
    
    # Calcula primeiro dígito verificador
    soma1 = sum(int(cpf[i]) * (10 - i) for i in range(9))
    digito1 = 11 - (soma1 % 11)
    if digito1 >= 10:
        digito1 = 0
    
    # Calcula segundo dígito verificador
    soma2 = sum(int(cpf[i]) * (11 - i) for i in range(10))
    digito2 = 11 - (soma2 % 11)
    if digito2 >= 10:
        digito2 = 0
    
    # Verifica dígitos verificadores
    return int(cpf[9]) == digito1 and int(cpf[10]) == digito2

def format_cpf(cpf):
    """
    Formata CPF no padrão XXX.XXX.XXX-XX
    
    Args:
        cpf: String do CPF (apenas números)
        
    Returns:
        str: CPF formatado ou string vazia se inválido
    """
    if not cpf or len(cpf) != 11:
        return ""
    
    return f"{cpf[:3]}.{cpf[3:6]}.{cpf[6:9]}-{cpf[9:]}"

def limpar_cpf(cpf):
    """
    Remove formatação do CPF, mantendo apenas números
    
    Args:
        cpf: String do CPF
        
    Returns:
        str: CPF apenas com números
    """
    if not cpf:
        return ""
    
    return re.sub(r'[^0-9]', '', cpf)

def normalizar_cpf(cpf):
    """
    Normaliza CPF removendo formatação e validando
    
    Args:
        cpf: String do CPF
        
    Returns:
        tuple: (cpf_limpo, is_valid)
    """
    cpf_limpo = limpar_cpf(cpf)
    is_valid = validar_cpf(cpf_limpo)
    
    return cpf_limpo, is_valid
    
checkCPF(args)