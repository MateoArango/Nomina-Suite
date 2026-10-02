DescripcionDescripcionDescripcionDescripcionDescripcionDescripcionDescripcionDescripcionDescripcionDescripcionDescripcionDescripcionDescripcionDesii1234onDescripcioonDescripciocripcionDescripcionDescr

{"code":"BAD_REQUEST","message":"El empleado se encuentra en una incapacidad en el rango indicado.","timestamp":"2026-10-02T16:49:41.482529282Z"}
{
"kaNlPermiso": null,
"kaNlEmpleado": 10236,
"ddDesde": "2026-01-01",
"ddHasta": "2026-01-20",
"scCompensatorio": "N",
"scPermiso": "S",
"scDescripcion": "Testing the error vacations already selected on this date for 98452583",
"ddFechaElab": "2026-10-02",
"kaNlUsuario": 677,
"ndActoAdministrativo": 1,
"ddActoAdministrativo": "2026-01-01",
"aprobada": "N",
"fechaAprobacion": null,
"usuarioAprueba": null,
"ibcPermiso": null
}

on the record 98452583

# ***Sumary***

This page is the Permisos (Leave Management) module of ADA’s Nómina (Payroll) system. It is used to record, view, and manage employee leaves of absence and special work permissions.

Key Features
Employee Search: Look up employees using their ID number (CC/NIT).

Permission History: View registered leaves and permissions for a selected employee.

Leave Data Entry: Set start/end dates, add descriptions, mark approval statuses, specify administrative acts, and toggle compensatory settings.

Action Controls: Create new records, save updates, or delete existing permission entries.

984525831213934212
1111111111111022200

| field | bound | ErrorMsg |
| --- | --- | --- |
| CCNIT | max 18 | Error For input string: "9845258312139342000" |
| Acto administrativo | max 19 | Error Numeric value ({input value}) out of range |
| Descripción | max 200 | scDescripcion debe tener máximo 200 caracteres |

## Logic flow

### Listado de permisos
The app allow select an employ for an specific CC existing on module 'Empleados', to do this you need put the correct cc
and later click on 'Buscar CC/NIT' to pick up values on 'Listado de Permisos' or if you want to add another permisson
on 'Datos del Permiso' form. Next to 'Buscar CC/NIT' you can click on 'Seleccionar' for open a side panel called 'Seleccionar
Empleado', so once you're there can look at in a list from a request copy of the 'Empleados module' list that we were talking
a few moments and pick up either record. For 'Seleccionar Empleado' there are 2 inputs named: 'Consultar' & 'Tipo de tercero',
for this automation suite we only cover 'Consultar' neither 'Tipo de tercero'.

### Listado de permisos

Once you have a selected CC, you can look at the current permissions, like an historic table with four columns
|Aprobada	|Empleado|	Desde	|Hasta	|Descripción
for that record.

### Datos del permiso
Here is the main flow, we can there assign dates with the fields Desde|Hasta, this is connected with other modules so 
if an employee has vacations, Incapacidades, Licencias, Licencias por calamidad, etc inside the desired range it notifies
with a correct error modal and avoid to save changes.

There's Descripción camp like text-area. These checkbox areas has a relation on its behavior so checking for 'Compensatorio'
it changes 'Permiso', the relation is the next:

Compensatorio = SI => Permiso = NO

Compensatorio = NO => Permiso = NO

Compensatorio = NO => Permiso = SI

Although there isn't a '*' for 'Acto administrativo' is a obligatory field and you can put there a repeat or either number there.

For Fecha acto administrativo you cannot select a date grater than 'Desde*', only the equal or less.
The error message is 'Error
La Fecha Acto debe ser menor o igual a la Fecha Desde.'

Ok, until now we don't have touched the main main checkbox area: 'APROBADA *' why? this allow to allow a permission on the
'Lista de Permisos' to be editable or only read mode, so if it's approved it is blocked and no  allow future
modifications, as well the delete record is disabled. 

Finally, ignore IBC permiso$.
## NavBar buttons
There are 3 buttons, Nuevo, Guardar and Eliminar (deletes from 'Lista de Permisos' but if the record is approved it's
not allow to delete it, so Guardar and Eliminar are disabled).

## Requests

### Empleado
- https://nomina-qa-api.adacsc.co/api/v1/w-vacaciones-licencias-ascensos-permisos/empleados/by-nitsd/98452583

- - This one allows a brief description.

### Listado del Permiso
- https://nomina-qa-api.adacsc.co/api/v1/w-vacaciones-licencias-ascensos-permisos/rows?kaNlTercero=10236&limit=200&calamidad=N
- - This one brings a list of all rows
### Datos del Permiso
- https://nomina-qa-api.adacsc.co/api/v1/w-vacaciones-licencias-ascensos-permisos/rows/432
- - This one is for all information for the main form.