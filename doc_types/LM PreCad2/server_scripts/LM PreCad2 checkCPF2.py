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
def checkCPF2(args):
    frappe.log_error("início de checkCPF ", "checkCPF Error")
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
        
        cpf = dict_doc["cpf"].strip()
        
        # Limpar CPF para busca (remover formatação)
        cpf_limpo = re.sub(r'[^0-9]', '', cpf)
        
        frappe.log_error(str(cpf_limpo), "checkCPF")
        frappe.logger().info(f"checkCPF - Buscando CPF: {cpf_limpo}")
        
        
        # Buscar cliente pelo CPF - versão otimizada
        customer_name = frappe.db.get_value("Customer", {"tax_id": cpf_limpo}, "name")
    
        # Se não encontrar, tenta com CPF formatado
        if not customer_name:
            customer_name = frappe.db.get_value("Customer", {"tax_id": cpf_limpo}, "name")
    
        
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
