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
#------------------------------------------------------------------------------------------------------------------------------------------//
#------------------------------------------------------------------------------------------------------------------------------------------//

def checkCPF(args):
    try:
        dict_doc = json.loads(args.doc)
        # doc = frappe.get_doc("LM PreCad", dict_doc["name"])
        ok = False
        doc = {}
        existente = frappe.db.exists("Customer", {"tax_id": dict_doc["cpf"]})
        if existente:

            customer_name = frappe.db.get_value("Customer", {"tax_id": dict_doc["cpf"]})
            
            if customer_name:
                doc = frappe.get_doc("Customer", customer_name).as_dict()
                ok = True
               
        frappe.response['message'] = {"ok": ok, "doc": doc }
        
    except Exception as e:
      frappe.msgprint(f"*** checkCPF: {e} ")
      frappe.response['message'] = {"existente": False, "erro": e }
      frappe.log_error(f"Erro em checkCPF {e} ")

checkCPF(args)
