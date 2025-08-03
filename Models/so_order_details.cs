using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace PurpleRice.Models
{
    [Table("so_order_details")]
    public class so_order_details
    {
        public string within_code { get; set; }
        public string id { get; set; }
        public int sequence_id { get; set; }
        public string salestype { get; set; }
        public DateTime orderdate { get; set; }
        public string goods_id { get; set; }
        public string sp { get; set; }
        public decimal? unitqty { get; set; }
        public decimal? inqty { get; set; }
        public decimal? bpackqty { get; set; }
        public decimal? retuqty { get; set; }
        public decimal? retinqty { get; set; }
        public decimal? retbpqty { get; set; }
        public decimal? unitprice { get; set; }
        public decimal? unitdisc { get; set; }
        public decimal? unitdisc2 { get; set; }
        public decimal? unitpfund { get; set; }
        public decimal? amount { get; set; }
        public string price_source { get; set; }
        public string free_no { get; set; }
        public string is_free { get; set; }
        public string glcode { get; set; }
        public string apcode { get; set; }
        public string upper_goods { get; set; }
        public string is_not_enough_stock { get; set; }
        public string reference_no { get; set; }
        public string remarks { get; set; }
        public string use_net_price { get; set; }
        public decimal? promotional_fund { get; set; }
        public decimal? flat_rebate { get; set; }
        public decimal? distribution_allowance { get; set; }
        public decimal? adhoc_discount { get; set; }
        public decimal? introductory_offer { get; set; }
        public decimal? damage_allowance { get; set; }
        public decimal? bags_allowance { get; set; }
        public decimal? promotional_discount { get; set; }
        public decimal? other_discount1 { get; set; }
        public decimal? other_discount2 { get; set; }
        public decimal? other_discount3 { get; set; }
        public string invoice_desc { get; set; }
        public string invoice_desc_english { get; set; }
        public string customer_po { get; set; }
        public string customer_goods_id { get; set; }
        public string action { get; set; }
        public int? po_line_num { get; set; }
        public string line_no { get; set; }
        public string item_source { get; set; }
    }
} 